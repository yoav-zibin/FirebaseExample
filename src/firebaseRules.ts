module firebaseRules {
  interface Rule {
   [name: string]: Rule | string;
  }
  function prettyJson(obj: any): string {
    return JSON.stringify(obj, null, '  ')
  }
  function getRulesJson(): string {
    let rules: any = getRules();
    addValidateNoOther(rules);
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

  function validateSecureUrl() {
    return validate(`newData.isString() && newData.val().beginsWith("https://") && newData.val().length >= 10 && newData.val().length < 500`);
  }

  function validateEmail() {
    return validate("newData.isString() && newData.val().matches(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,4}$/i)");
  }

  function validateUid() {
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

  function validateNumber(fromInclusive: number, toInclusive: number): Rule {
    return validate(`newData.isNumber() && newData.val() >= ${fromInclusive} && newData.val() <= ${toInclusive}`);
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

  function addValidateNoOther(rules: any): void {
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
      }
    }
    
    if (keys.length > 1) {
      for (let key of keys) {
        if (key.charAt(0) == '$') throw new Error("You can't use a $ property with other non-$ properties, but you have these keys=" + keys);
      }
    }
    // recurse
    for (let key of keys) {
      addValidateNoOther(rules[key]);
    }
  }

  const ANYONE = "auth != null";
  // Anyone can add a new image,
  // but not delete/modify values (only the uploader can change anything).
  const ADD_OR_UPLOADER = "!data.exists() || data.child('uploader_uid').val() == auth.uid";
  
  /* 
  - permission cascades down: 
      once you've granted read or write permission on a certain level in the tree,
      you cannot take that permission away at a lower level. 
  - .validate rules are different:
      data is only considered valid when all validation rules are met.
      (http://stackoverflow.com/questions/39082513/catch-all-other-firebase-database-rule)

  Docs: https://firebase.google.com/docs/reference/security/database/
  root.child($game_id + '/users/' + auth.uid + '/speedGameWith').exists()   
  */
  function getRules(): Object {
    return {
      ".read": "false",
      ".write": "false",
      "images": {
        ".read": ANYONE,
        ".indexOn": ["is_board_image"],
        "$image_id": {
          ".write": ADD_OR_UPLOADER,
          "downloadURL": validateSecureUrl(),
          "width": validateNumber(10, 1024),
          "height": validateNumber(10, 1024),
          "is_board_image": validateBoolean(),
          "key": validateString(100),
          "name": validateString(100),
          "uploader_email": validateEmail(),
          "uploader_uid": validateUid(),
          "createdOn": validateNow(),
        },
      },
      // Stores info about all the game specs.
      "specs": {
        ".read": ANYONE,
        "$game_name": {
          ".write": ADD_OR_UPLOADER,
          "uploader_uid": validateUid(),
          "createdOn": validateNow(),
          // Info about the board, e.g., the image, and in the future other properties such as whether you can zoom in, background color, etc.
          "board": {
            "imageId": validateString(100),
          },
          // Initial position of all element (such as pieces, dice, decks of cards, etc)
          "initialPositions": {
            "$element_index": { // initialPositions is an array, so $element_index is a 0-based index, i.e., an integer >= 0
              "elementTypeId": validateString(100),
              // The X position is 1.4% of the board width to the left.
              "positionX": validateNumber(0, 100),
              // The Y position is 91.44% of the board height from the top.
              // E.g. the top left point has @position=0 and @positionY=0.
              "positionY": validateNumber(0, 100),
            },
          },          
        },
      },
      // Stores public and private info about the users of GameBuilder and GamePortal.
      "users": {
        "$user_id": {
          ".read": "$user_id === auth.uid",
          ".write": "$user_id === auth.uid",
          // Contains fields that anyone can read, but only $user_id can write.
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
          // Contains fields that only $user_id can read&write.
          "privateFields": {
            "email": validateEmail(),
            "phoneNumber": validateString(100, 0),
            "createdOn": validateNow(),
          },
          // Contains fields that are private (only $user_id can read), but others can add new fields if they’re new (so others can write as long as its new content)
          "privateButAddable": {
            // Chats in which the user is one of the participants
            "chats": {
              "$chat_id": {
                ".write": "!data.exists()",
                "addedByUid": validateUid(),
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
        "$push_key_id": {
          // Anyone can add a new value (or delete old values; although that's better done sever-side),
          // but not modify values.
          ".write": "!data.exists() || !newData.exists()",
          "uid": validateUid(),
          "timestamp": validateNow(),
        },
      },
      // All chats between users (2 or more users).
      "chats": {
        "$chat_id": {
          // Anyone can create a chat, but only the participants can read/modify it
          ".read": "data.child('participants').child(auth.uid).exists()",
          ".write": "!data.exists() || data.child('participants').child(auth.uid).exists()",
          "participants": {
            "$uid": validateBoolean(),
          },
          // An optional name (i.e., groupName can be "").
          "groupName": validateString(100, 0),
          "createdOn": validateNow(),
          // All the messages ever sent in this chat, ordered by timestamp the message arrived to firebase.
          "messages": {
            // The unique key generated by push() is based on a timestamp, so list items are automatically ordered chronologically.
            "$push_key_id": {
              "senderUid": validateUid(),
              "message": validateString(1000),
              "timestamp": validateNow(),
            },
          },
        },
      },
      pieces: support visibility for each subPiece: just to me or public.
      matches: like chats
    };
  }

  function init() {
    let r = getRulesJson();
    //console.log(r);
    (<HTMLTextAreaElement>document.getElementById('firebaseRulesTextarea')).value = r;
  }
  init();
}