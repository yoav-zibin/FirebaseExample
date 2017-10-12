module firebaseRules {
  interface Rule {
   [name: string]: Rule | string;
  }
  function prettyJson(obj: any): string {
    return JSON.stringify(obj, null, '  ')
  }
  function getRulesJson(): string {
    let rules: any = getRules();
    addValidateNoOther('', rules);
    return prettyJson({"rules": rules});
  }

  function validate(exp: string): Rule {
    return {
      ".validate": exp
    };
  }

  // maxLength excluding, minLength incuding.
  function validateString(maxLength: number, minLength: number = 1): Rule {
    return validate(`newData.isString() && newData.val().length >= ${minLength} && newData.val().length < ${maxLength}`);
  }

  function validateRegex(pattern: string): Rule {
    return validate(`newData.isString() && newData.val().matches(/^${pattern}$/)`);
  }

  function validateSecureUrl() {
    return validate(`newData.isString() && newData.val().beginsWith("https://") && newData.val().length >= 10 && newData.val().length < 500`);
  }

  function validateEmail(allowEmptyString: boolean) {
    let allowEmptyCondition = allowEmptyString ? "newData.val() == '' || " : "";
    return validate(`newData.isString() && (${allowEmptyCondition}newData.val().matches(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,4}$/i))`);
  }

  // Color is represented as an RGB string, e.g., FFFFFF is white.
  function validateColor() {
    return validateRegex("[0-9A-F]{6}");
  } 

  // https://stackoverflow.com/questions/36086317/firebase-push-id-what-characters-can-be-inside
  // Also correct for uid and other firebase IDs.
  // Examples:
  // cloud key id: "-KtSs_LylUvVkgrc433r" (len 20)
  // image id: "-KwC4GgT2oJXK-FaKGq3" (len 20)
  // user id: "KTz2OcYNrQUCy8brAV9D8rcj4it" or "zg1ZOW7P2AM7va3FAdnpUHGw2HD2" (len 27-28)
  const ID_PATTERN = "[-_A-Za-z0-9]{19-30}";
  function validateAnyId() {
    return validateRegex(ID_PATTERN);
  }

  function validateImageId() {
    return validate(`root.child('gameBuilder/images' + newData.val()).exists()`);
  }

  function validateElementId() {
    return validate(`root.child('gameBuilder/elements' + newData.val()).exists()`);
  }

  function validateMyUid() {
    return validate("newData.isString() && newData.val() === auth.uid");
  }

  function validateNow(): Rule {
    return validate(
      // messages cannot be added in the past or the future
      // clients must use firebase.database.ServerValue.TIMESTAMP
      // to ensure accurate timestamps
      "newData.isNumber() && newData.val() == now");
  }

  function validateBoolean(): Rule {
    return validate("newData.isBoolean()");
  }

  function validateTrue(): Rule {
    return validate("newData.isBoolean() && newData.val() == true");
  }
  

  function validateNumber(fromInclusive: number, toInclusive: number): Rule {
    return validate(`newData.isNumber() && newData.val() >= ${fromInclusive} && newData.val() <= ${toInclusive}`);
  }

  function validatePieceState(): Rule {
    return {
      // The top left point has x=0 and y=0.
      // The x position is 1.4% of the board width to the left.
      "x": validateNumber(0, 100),
      // The y position is 91.44% of the board height from the top.
      "y": validateNumber(0, 100),

      // For a toggable/dice element: the index of the currently selected image.
      // For a card element, currentImageIndex must always be 0
      // (and GamePortal should use cardVisiblity below to determine whether to show image index 0 or 1).
      "currentImageIndex": validateNumber(0, 100),

      // Card visibility: only set it for cards.
      // cardVisiblity contains exactly the userIds that can see the private face.
      // If this element is missing, that means no one can see the private face.
      // If this element is contains all the participants' ids, then everyone can see the private face.
      "cardVisiblity": {
        "$userId": validateTrue(),
      },
    };
  }

  function allowWrite(write: string, rule: Rule): Rule {
    if (rule[".write"]) throw new Error("Rule already has .write: " + prettyJson(rule));
    rule[".write"] = write;
    return rule;
  }

  function deleteElement(arr: string[], elem: string) {
    let index = arr.indexOf(elem);
    if (index != -1) {
      if (typeof arr[index] != "string") {
        throw new Error("key " + elem + " must have a string value, but it had the value of " + prettyJson(arr[index]));
      }
      arr.splice(index, 1);
    }
  }

  function getNonSpecialKeys(rule: Rule): string[] {
    let keys = Object.keys(rule);
    // remove the special keys: .read, .write, .validate, .indexOn
    deleteElement(keys, ".write");
    deleteElement(keys, ".read");
    deleteElement(keys, ".validate");
    deleteElement(keys, ".indexOn");
    for (let key of keys) {
      if (key.charAt(0) == '.') throw new Error("You can't start a property with '.', but you used key=" + key);
    }
    return keys;
  }

  function hasNonCollectionGrandchildren(rules: any): boolean {
    if (typeof rules == "string") throw new Error("Internal error: we traversed into a leaf");
    let allKeys = Object.keys(rules);
    if (allKeys.length == 1 && allKeys[0] == ".validate") return true; // leaf
    let keys = getNonSpecialKeys(rules);
    let result = false;
    for (let key of keys) {
      if (key.charAt(0) != '$') {
        result = result || hasNonCollectionGrandchildren(rules[key]);
      }
    }
    return result;
  }

  function addValidateNoOther(parentKey: string, rules: any): void {
    if (typeof rules == "string") return;
    if (typeof rules != "object") {
      throw new Error("rules can either be a string or object, but it was: rules=" + rules);
    }
    let keys = getNonSpecialKeys(rules);

    if (keys.length == 0) return;
    if (keys.length > 1 || keys[0].charAt(0) != '$') {
      rules["$other"] = { ".validate": false };
      
      let filteredChildren = keys.filter((key) => hasNonCollectionGrandchildren(rules[key])); 
      if (filteredChildren.length > 0) {
        let quotedChildren = filteredChildren.map((val)=>`'${val}'`).join(", ");
        // We use .validate only on the leaves.
        if (rules[".validate"]) throw new Error("Rule already has .validate: " + prettyJson(rules));
        rules[".validate"] = `newData.hasChildren([${quotedChildren}])`;
        // TODO: use parentKey (whether it is '$..Id' or '$...Index' to validate it).
      }
    }
    
    if (keys.length > 1) {
      for (let key of keys) {
        if (key.charAt(0) == '$') throw new Error("You can't use a $ property with other non-$ properties, but you have these keys=" + keys);
      }
    }
    // recurse
    for (let key of keys) {
      addValidateNoOther(key, rules[key]);
    }
  }

  const ANYONE = "auth != null";
  // Anyone can add a new image,
  // but not delete/modify values (only the uploader can change anything).
  const ADD_OR_UPLOADER = "!data.exists() || data.child('uploaderUid').val() == auth.uid";
  
  /* 
  - permission cascades down: 
      once you've granted read or write permission on a certain level in the tree,
      you cannot take that permission away at a lower level. 
  - .validate rules are different:
      data is only considered valid when all validation rules are met.
      (http://stackoverflow.com/questions/39082513/catch-all-other-firebase-database-rule)

  Docs: https://firebase.google.com/docs/reference/security/database/  
  */
  function getRules(): Object {
    return {
      ".read": "false",
      ".write": "false",
      "gameBuilder": {
        // Data here should only be written by GameBuilder (not GamePortal).
        // Anyone can read.
        ".read": ANYONE,
        "images": {
          ".indexOn": ["isBoardImage"],
          "$imageId": {
            ".write": ADD_OR_UPLOADER,
            "uploaderEmail": validateEmail(false),
            "uploaderUid": validateMyUid(),
            "createdOn": validateNow(),
            "downloadURL": validateSecureUrl(),
            "width": validateNumber(10, 1024),
            "height": validateNumber(10, 1024),
            "isBoardImage": validateBoolean(),
            "cloudStorageKey": validateString(100),
            "name": validateString(100),
          },
        },
        "elements": {
          "$elementId": {
            ".write": ADD_OR_UPLOADER,
            "uploaderEmail": validateEmail(false),
            "uploaderUid": validateMyUid(),
            "createdOn": validateNow(),
            "images": {
              "$imageIndex": {
                "imageId": validateImageId(),
              },
            },

            // Sometimes you can't drag elements, e.g., dice, deck, etc.
            "isDraggable": validateBoolean(), 

            // Toggable pieces will rotate (round-robin) between the array of images.
            // E.g., used in games like Reversi, Checkers.
            "isToggable": validateBoolean(),

            // A dice element as in backgammon or D&D games.
            // E.g., a 6-sided dice will have an array of images of length 6.
            "isDice": validateBoolean(),

            // Cards are elements that have two faces: a public face and a private face.
            // If isCard is true, then images must have exactly 2 images.
            // The public face is the image in index=0, and the private face is in index=1.
            // E.g., in a game of poker, each card has two faces: the public face is what everyone
            // can see, and the private face is the actual card (e.g., prince of diamonds).
            // Another example is the game of Stratego, where pieces have two faces (one public and one private).
            "isCard": validateBoolean(),

            // When a game spec contains a deck, it must contain all its elements as well.
            "deck": {
              "$elementIndex": {
                "elementId": validateElementId(),
              },
            },
          },
        },
        // Stores info about all the game specs.
        "specs": {
          "$gameNameUnique": {
            ".write": ADD_OR_UPLOADER,
            "uploaderEmail": validateEmail(false),
            "uploaderUid": validateMyUid(),
            "createdOn": validateNow(),
            // Info about the board.
            "board": {
              "imageId": validateImageId(),
              "backgroundColor": validateColor(),
              // Similar to:
              // <meta name="viewport" content="maximum-scale=1" />
              // maxScale=1 means you can't zoom at all.
              // maxScale=2 means you can zoom up to 2X. Etc.
              "maxScale": validateNumber(1, 10),
            },
            // All the pieces in the game.
            // Every piece is an element, an a element may be included many times.
            // E.g., Reversi has many pieces, all built from the same element.
            "pieces": {
              // pieces is an array, so $pieceIndex is a 0-based index, i.e., an integer >= 0
              "$pieceIndex": { 
                "elementId": validateElementId(),
                "initialState": validatePieceState(),

                // If this element belongs to a deck, then deckPieceIndex will contain 
                // the pieceIndex of the matching deck.
                // If this element does not belong to a deck, then store -1.
                "deckPieceIndex": validateNumber(-1, 1000),
              },
            },          
          },
        },
      },
      // Stores public and private info about the users of GameBuilder and GamePortal.
      "users": {
        "$userId": {
          ".read": "$userId === auth.uid",
          ".write": "$userId === auth.uid",
          // Contains fields that anyone can read, but only $userId can write.
          "publicFields": {
            ".read": ANYONE,
            "avatarImageUrl": validateSecureUrl(),
            "displayName": validateString(100),
            // Whether the user is currently connected or not.
            // You must support a single user having multiple connections: 
            // the user should listen to changes to isConnected,
            // and if it becomes false while the user is still connected,
            // then the user should set it back to true.
            "isConnected": validateBoolean(),
            // The timestamp when the user last disconnected from firebase.
            // You can convert it to a date in JS using:
            // new Date(1506721603537)
            // returns
            // Fri Sep 29 2017 17:46:43 GMT-0400 (EDT)
            "lastSeen": validateNow(),
          },
          // Contains fields that only $userId can read&write.
          "privateFields": {
            "email": validateEmail(true),
            "phoneNumber": validateString(100, 0),
            "createdOn": validateNow(),
          },
          // Contains fields that are private (only $userId can read), but others can add new fields if they’re new (so others can write as long as its new content)
          "privateButAddable": {
            // Groups in which the user is one of the participants
            "groups": {
              "$groupId": {
                ".write": "!data.exists()",
                "addedByUid": validateMyUid(),
                "timestamp": validateNow(),
              },
            },
          },
        },
      },
      // The last 20 users that got connected. 
      // (When a user connects he should add himself, and there is a cloud function that deletes old entries.)
      "recentlyConnected": {
        ".read": ANYONE,
        "$messageId": {
          // Anyone can add a new value (deleting values is done using cloud functions).
          ".write": "!data.exists()",
          "uid": validateMyUid(),
          "timestamp": validateNow(),
        },
      },
      // All groups of users (2 or more users).
      "groups": {
        "$groupId": {
          // Anyone can create a group, but only the participants can read/modify it
          ".read": "data.child('participants').child(auth.uid).exists()",
          ".write": "!data.exists() || data.child('participants').child(auth.uid).exists()",
          "participants": {
            "$uid": validateTrue(),
          },
          // An optional name (i.e., groupName can be "").
          "groupName": validateString(100, 0),
          "createdOn": validateNow(),
          // All the messages ever sent in this group, ordered by time (so newer messages have higher $messageId).
          "messages": {
            // The unique key generated by push() is based on a timestamp, so list items are automatically ordered chronologically.
            "$messageId": {
              "senderUid": validateMyUid(),
              "message": validateString(1000),
              "timestamp": validateNow(),
            },
          },
          // I recommend allowing in the UI at most one match in a group,
          // but the DB allows multiple matches.
          "matches": {
            "$matchId": {
              "gameNameUnique": validateString(100),
              "createdOn": validateNow(),
              "lastUpdatedOn": validateNow(),
              "pieces": {
                "$pieceIndex": {
                  "currentState": validatePieceState(),
                },
              },
            },
          },
        },
      },
    };
  }

  function init() {
    let r = getRulesJson();
    //console.log(r);
    (<HTMLTextAreaElement>document.getElementById('firebaseRulesTextarea')).value = r;
  }
  init();
}