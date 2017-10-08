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
      // clients should use firebase.database.ServerValue.TIMESTAMP
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
      "specs": {
        ".read": ANYONE,
        "$game_name": {
          ".write": ADD_OR_UPLOADER,
          "uploader_uid": validateUid(),
          "spec": validateString(5000),
          "createdOn": validateNow(),
        },
      },
      "users": {
        "$user_id": {
          ".read": "$user_id === auth.uid",
          ".write": "$user_id === auth.uid",
          "publicFields": {
            ".read": ANYONE,
            "avatarImageUrl": validateSecureUrl(),
            "displayName": validateString(100),
            "isConnected": validateBoolean(),
            "lastSeen": validateNow(),
          },
          "privateFields": {
            "email": validateEmail(),
            "createdOn": validateNow(),
          },
          "privateButAddable": {
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
      "recentlyConnected": {
        "$push_key_id": {
          // Anyone can add a new value (or delete old values; although that's better done sever-side),
          // but not modify values.
          ".write": "!data.exists() || !newData.exists()",
          "uid": validateUid(),
          "timestamp": validateNow(),
        },
      },
      "chats": {
        "$chat_id": {
          // Anyone can create a chat, but only the participants can read/modify it
          ".read": "data.child('participants').child(auth.uid).exists()",
          ".write": "!data.exists() || data.child('participants').child(auth.uid).exists()",
          "participants": {
            "$uid": validateBoolean(),
          },
          "groupName": validateString(100, 0),
          "createdOn": validateNow(),
          "messages": {
            "$push_key_id": {
              "senderUid": validateUid(),
              "message": validateString(1000),
              "timestamp": validateNow(),
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