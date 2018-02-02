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
    return rules;
  }

  function addValidate(rule: Rule, exp: string): Rule {
    rule[".validate"] += " && (" + exp + ")";
    return rule;
  }

  function validate(exp: string): Rule {
    return {
      ".validate": exp
    };
  }

  function validateOptionalString(maxLengthExclusive: number) {
    return validateStringLen(0, maxLengthExclusive)
  }
  function validateMandatoryString(maxLengthExclusive: number): Rule {
    return validateStringLen(1, maxLengthExclusive)
  }
  // maxLength excluding, minLength incuding.
  function validateStringLen(minLengthInclusive: number, maxLengthExclusive: number): Rule {
    return validate(`newData.isString() && newData.val().length >= ${minLengthInclusive} && newData.val().length < ${maxLengthExclusive}`);
  }

  const BEFORE_REGEX = `newData.isString() && newData.val().matches(/^`;
  const AFTER_REGEX = `$/)`;
  function validateRegex(pattern: string): Rule {
    return validate(`${BEFORE_REGEX}${pattern}${AFTER_REGEX}`);
  }
  function getRegexPattern(validateStr: string): string {
    return beginsWith(validateStr, BEFORE_REGEX) && endsWith(validateStr, AFTER_REGEX) ? validateStr.substring(BEFORE_REGEX.length, validateStr.length - AFTER_REGEX.length) : '';
  }

  function validElementImageProp(prop: string) {
    return `(newData.parent().parent().parent().child('${prop}').val() === root.child('gameBuilder/images/' + newData.val() + '/${prop}').val())`;
  }

  function validateSecureUrl() {
    return validate(`newData.isString() && newData.val().beginsWith("https://") && newData.val().length >= 10 && newData.val().length < 500`);
  }

  function validateOptionalEmail() {
    return validateEmail(true);
  }
  function validateMandatoryEmail() {
    return validateEmail(false);
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
  const ID_PATTERN = "[-_A-Za-z0-9]{17,40}";

  function validateAnyId() {
    return validateRegex(ID_PATTERN);
  }

  const YOUTUBE_VIDEO_ID_PATTERN = "[-_A-Za-z0-9]{11}"; // e.g. -FyjEnoIgTM or lWhqORImND0

  function validateImageIdOfSize(width: number, height: number): string {
    return `root.child('gameBuilder/images/' + newData.val() + '/width').val() === ${width} && root.child('gameBuilder/images/' + newData.val() + '/height').val() === ${height}`;
  }

  function validateBoardImage(): string {
    return `root.child('gameBuilder/images/' + newData.val() + '/isBoardImage').val() === true`;
  }

  function validateIdValueExists(path: string, value: string) {
    return validate(`root.child('${path}' + ${value}).exists()`);
  }

  function validateNewDataIdExists(path: string) {
    return validateIdValueExists(path, 'newData.val()');
  }

  function validateImageId() {
    return validateNewDataIdExists(`gameBuilder/images/`);
  }
  
  function validateElementId() {
    return validateNewDataIdExists(`gameBuilder/elements/`);
  }
  
  function validateGameSpecId() {
    return validateNewDataIdExists(`gameBuilder/gameSpecs/`);
  }
  
  function validateMyUid() {
    return validate("newData.isString() && newData.val() === auth.uid");
  }

  function validateUserId() {
    return validateNewDataIdExists("users/");
  }

  function validateGroupId() {
    return validateNewDataIdExists("gamePortal/groups/");
  }

  const VALIDATE_NOW = "newData.isNumber() && newData.val() == now";
  function validateNow(): Rule {
    return validate(
      // messages cannot be added in the past or the future
      // clients must use firebase.database.ServerValue.TIMESTAMP
      // to ensure accurate timestamps
      VALIDATE_NOW);
  }

  function validateBoolean(): Rule {
    return validate("newData.isBoolean()");
  }

  function validateTrue(): Rule {
    return validate("newData.isBoolean() && newData.val() == true");
  }
  
  function validateInteger(fromInclusive: number, toInclusive: number) {
    return validateNumber(fromInclusive, toInclusive, true);
  }
  function validateNumber(fromInclusive: number, toInclusive: number, isInteger: boolean = false): Rule {
    let intCond = isInteger ? "&& (newData.val() % 1 === 0.0) " : "";
    return validate(`newData.isNumber() ${intCond}&& newData.val() >= ${fromInclusive} && newData.val() <= ${toInclusive}`);
  }

  const MAX_IMAGES_IN_ELEMENT = 256;
  const MAX_IMAGES_IN_DECK = 256;
  const MAX_PIECES = 256;
  const MAX_USERS_IN_GROUP = 10;

  function validatePieceState(): Rule {
    return {
      // The top left point of the board has x=0 & y=0.
      // x=1.4 means the top-left point was moved 1.4% of the board width to the left.
      // Note that x=100 means the image is completely outside the board, so x should be less
      // than 100.
      // We allow a negative x (up to -100) to allow the image to be dragged a bit out of the board.
      // GamePortal shouldn't allow the image to be completely dragged outside the board because
      // there should always be the option to drag it back onto the board.
      "x": validateNumber(-100, 100),
      // Similar to "x".
      "y": validateNumber(-100, 100),

      // zDepth (like z-index in CSS) means how close the object is to the user.
      // Greater zDepth numbers mean closer to the observer
      // Whenever you drag a piece, it should get a zDepth that makes it closest to the observer.
      // After shuffling a deck, zDepth should determine the order of the cards.
      "zDepth": validateNumber(1, 100000000000000000),

      // For a toggable/dice element: the index of the currently selected image.
      // For a card/standard element, currentImageIndex must always be 0
      // (and GamePortal should use cardVisibility below to determine whether to show image index 0 or 1).
      "currentImageIndex": validateInteger(0, MAX_IMAGES_IN_ELEMENT),

      // Card visibility: only set it for cards.
      // cardVisibility contains exactly the participant indices that can see the private face.
      // If this element is missing, that means no one can see the private face.
      // If this element is contains all the participants' ids, then everyone can see the private face.
      "cardVisibility": { // A set of participant indices (participantIndex)
        "$participantIndex": validateTrue(), // Using 'true' is arbitrary: we just need to have something after the participantIndex.
      },

      // If the piece is rotatable (has rotatableDegrees), then you
      // can set the current rotation of the piece in degrees.
      "rotationDegrees": validateNumber(0, 360),

      // If the piece is drawable, this is the current drawing.
      // A drawing is made out of many lines.
      "drawing": {
        "$lineId": {
          "userId": validateMyUid(),
          "timestamp": validateNow(),
          "color": validateColor(),
          // All the number belows are percentages (0-100).
          // Line thinkness is in percentages of board width,
          // e.g., 2 means that the line thickness is 2% of the board's width,
          // and if the board width is 1000 pixels, then the lineThickness is 20 pixels.
          "lineThickness":  validateNumber(0, 100), 
          "fromX": validateNumber(0, 100),
          "fromY": validateNumber(0, 100),
          "toX": validateNumber(0, 100),
          "toY": validateNumber(0, 100),
        },
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

  function beginsWith(str: string, searchStr: string) {
    return str.substr(0, searchStr.length) === searchStr;
  }
  function endsWith(str: string, searchStr: string) {
    return str.substr(str.length - searchStr.length,
                       searchStr.length) === searchStr;
  }

  function getValidateIndex(parentKey: string, maxExclusive: number): Rule {
    // We can't do:
    // (${parentKey} % 1 === 0.0) && 
    // because convert a string to number in firebase rules (see https://medium.com/front-end-hacking/fun-with-firebase-security-rules-3c0304efa29).
    // I can't even do >= and <=  
    // So we just ensure it's all digits.
    let maxDigitsNum = Math.ceil((<any>Math).log10(maxExclusive));
    return validate(`${parentKey}.matches(/^[0-9]{1,${maxDigitsNum}}$/)`);
  }

  function getValidateForParentKey(parentKey: string): Rule {
    switch (parentKey) {
      case "$friendUserId":
      case "$participantUserId":
      case "$reviewerUserId":
        return validateIdValueExists("users/", parentKey);
      case "$deckMemberElementId": return validateIdValueExists("gameBuilder/elements/", parentKey);
      case "$reviewedGameSpecId": return validateIdValueExists("gameBuilder/gameSpecs/", parentKey);
      case "$memberOfGroupId": return validateIdValueExists("gamePortal/groups/", parentKey);
      case "$imageIndex": return getValidateIndex(parentKey, MAX_IMAGES_IN_ELEMENT);
      case "$pieceIndex": return getValidateIndex(parentKey, MAX_PIECES);
      case "$deckMemberIndex": return getValidateIndex(parentKey, MAX_IMAGES_IN_DECK);
      case "$participantIndex": return getValidateIndex(parentKey, MAX_USERS_IN_GROUP);
      
      //"elaM4m3sjE0:APA91bHGBqZDfiyl1Hnityy3nE-G-GsC2-guIsGCaT0ua4RPjx-AYr0HSsp2_mzVDaMabKj97vgPq_qqn225gzNHyDIk4ypuAeH4PudoeVgV36TxbhNpRQflo_YEVP8-A9CbiAzHn__S",
      case "$fcmToken": return validate(`${parentKey}.matches(/^.{140,200}$/)`);
      case "$fieldValue": return validate(`${parentKey}.matches(/^.{1,200}$/)`);
      
      
      case "$groupId": 
      case "$userId": 
      case "$imageId":
      case "$elementId":
      case "$gameSpecId": 
      case "$messageId":
      case "$matchId":
      case "$recentlyConnectedEntryId":
      case "$signalEntryId":
      case "$lineId":
        return validate(`${parentKey}.matches(/^${ID_PATTERN}$/)`);
    }
    throw new Error("Illegal parentKey=" + parentKey);
  }

  function addValidateNoOther(parentKey: string, rules: any): void {
    if (typeof rules == "string") return;
    if (typeof rules != "object") {
      throw new Error("rules can either be a string or object, but it was: rules=" + rules);
    }
    let keys = getNonSpecialKeys(rules);

    let validateConditions: string[] = [];
    if (keys.length > 1 || (keys.length > 0 && keys[0].charAt(0) != '$')) {
      rules["$other"] = { ".validate": false };
      
      let filteredChildren = keys.filter((key) => hasNonCollectionGrandchildren(rules[key])); 
      
      // filter out $elementId.name because I added it later.
      if (parentKey == "$elementId") filteredChildren = filteredChildren.filter((key) => key != "name"); 
      // filter out rotationDegrees and supportsWebRTC because I added those later.
      // filter out pushNotificationsToken because it's deprecated.
      filteredChildren = filteredChildren.filter((key) => ["supportsWebRTC", "rotationDegrees", "pushNotificationsToken"].indexOf(key) == -1);

      if (filteredChildren.length > 0) {
        let quotedChildren = filteredChildren.map((val)=>`'${val}'`).join(", ");
        validateConditions.push(`newData.hasChildren([${quotedChildren}])`);
      }
    }

    if (parentKey.charAt(0) == '$') {
      validateConditions.push(<string>getValidateForParentKey(parentKey)[".validate"]);
    }
    if (validateConditions.length > 0) {
      if (rules[".validate"]) {
        validateConditions.push("(" + rules[".validate"] + ")");
      }
      rules[".validate"] = validateConditions.join(" && ");
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
  const ONLY_ME = "$userId === auth.uid";
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
      // Data in gameBuilder should only be written by GameBuilder (not GamePortal).
      // Anyone can read.
      "gameBuilder": {
        ".read": ANYONE,
        "images": {
          ".indexOn": ["isBoardImage"],
          "$imageId": {
            ".write": ADD_OR_UPLOADER,
            ".validate": "newData.child('isBoardImage').val() === false || newData.child('width').val() === 1024 || newData.child('height').val() === 1024",
            "uploaderEmail": validateMandatoryEmail(),
            "uploaderUid": validateMyUid(),
            "createdOn": validateNow(),
            "width": validateNumber(10, 1024),
            "height": validateNumber(10, 1024),
            "isBoardImage": validateBoolean(),
            "downloadURL": validateSecureUrl(), // URL that allows downloading from cloudStorage.
            "sizeInBytes": validateNumber(100, 2 * 1024 * 1024), // At most 2MB per image (though even board images should be around 512KB).
            "cloudStoragePath": validateRegex(`images\\/${ID_PATTERN}[.](gif|png|jpg)`), // e.g., "images/-KuV-Y9TXnfnaZExRTli.gif"
            "name": validateMandatoryString(100),
          },
        },
        "elements": {
          "$elementId": {
            ".write": ADD_OR_UPLOADER,
            "uploaderEmail": validateMandatoryEmail(),
            "uploaderUid": validateMyUid(),
            "createdOn": validateNow(),
            "width": validateNumber(10, 1024),
            "height": validateNumber(10, 1024),
            "name": validateOptionalString(100),

            // An array of image ids.
            // All the images must have the same width&height as that of the element.
            // Read about arrays in firebase DB: http://firebase.googleblog.com/2014/04/best-practices-arrays-in-firebase.html
            "images": {
              "$imageIndex": {
                "imageId": addValidate(validateImageId(),
                    `${validElementImageProp('width')} && ${validElementImageProp('height')}`),
              },
            },
            
            // Sometimes you shouldn't be able to drag elements,
            // e.g., dice, deck, a drawable piece of paper, etc.
            "isDraggable": validateBoolean(),

            // Standard:
            // Standard elements have a single image in images array.
            //
            // Toggable:
            // Toggable elements will rotate (round-robin) between the array of images.
            // E.g., used in games like Reversi, Checkers.
            //
            // Dice:
            // A dice element as in backgammon or D&D games.
            // E.g., a 6-sided dice will have an array of images of length 6.
            // In backgammon you can represent the two dices as one element with 36 images.
            //
            // Card:
            // Cards are elements that have two faces: a public face and a private face.
            // Cards must have exactly 2 images.
            // The public face is the image in index=0, and the private face is in index=1.
            // E.g., in a game of poker, each card has two faces: the public face is what everyone
            // can see, and the private face is the actual card (e.g., prince of diamonds).
            // Another example is the game of Stratego, where pieces have two faces (one public and one private).
            //
            // Deck (two kinds: cardsDeck|piecesDeck):
            // Cards can be grouped into a deck,
            // and a deck has a special operation: shuffle!
            // Shuffling moves all the deck members (all the cards) to be within
            // the deck area (depending on the width&height of the deck), and shuffles the cards zDepth.
            // When a game spec contains a deck, it must contain all its elements as well.
            // After shuffling a deck, all its members receive their
            // initial cardVisibility (as set in that piece initialState).
            // Initially, when a game starts, a deck is shuffled.
            // There are two kinds of decks:
            // 1) cardsDeck: A deck of cards, where the cards are stacked on top of another,
            // so you can only take a card that's within the deck area if it has the heighest zDepth.
            // 2) piecesDeck: Like in Stratego, where the red/blue pieces are one deck, and you
            // can shuffle the deck, but you can take a piece from anywhere in the deck.
            "elementKind": validateRegex("standard|toggable|dice|card|cardsDeck|piecesDeck"),

            // In some game, pieces can be rotated, e.g., Blokus, Dominoes.
            // Note that different pieces can be rotated by different degrees.
            // E.g.,
            // * a piece that looks like a long line can only rotate my multiples of 180 degrees.
            // * a piece that looks like the letter L can rotate my multiples of 90 degrees.
            // * a piece that looks like a square cannot rotate (i.e., by multiples of 360 degrees).
            // (If the piece can't rotate at all, use rotatableDegrees=360)
            // If a piece can rotate, then it must be a standard|toggable|card elementKind (to simplify GamePortal UI).
            "rotatableDegrees": validateNumber(1, 360),

            "deckElements": {
              "$deckMemberIndex": {
                "deckMemberElementId": validateElementId(),
                // Ensure this member is a card element.
                ".validate": "root.child('gameBuilder/elements/' + newData.child('deckMemberElementId').val()).child('elementKind').val() === 'card'",
              },
            },

            // In some games you want to be able to draw on elements
            // (only if elementKind is standard or card),
            // like in dots-and-boxes or Diplomacy.
            // When drawing on a card, you draw on the private face of the card.
            // Each player will have his own unique color based on his participantIndex,
            // use the first 10 colors from https://sashat.me/2017/01/11/list-of-20-simple-distinct-colors/ 
            // (so participantIndex=0 has color red #e6194b)
            "isDrawable": validateBoolean(),

            // Validate the number of images fits with the elementKind.
            ".validate": 
              // A deck should have at least 2 deck members (otherwise, no deck memebers!)
              "(newData.child('elementKind').val().matches(/^cardsDeck|piecesDeck$/) ? newData.child('deckElements/1').exists() : !newData.child('deckElements').exists()) " +
              // isDrawable only for elementKind of standard|card
              " && (newData.child('isDrawable').val() === false || newData.child('elementKind').val().matches(/^standard|card$/)) " +
              // If the piece can rotate, then it must be standard.
              " && (newData.child('rotatableDegrees').val() === 360 || newData.child('elementKind').val().matches(/^standard|card|toggable$/)) " +
              // All element kinds (including decks) should have at least one image.
              " && newData.child('images/0').exists() " +
              ' && (' +
              // standard and decks should have exactly one image.
              " (newData.child('elementKind').val().matches(/^standard|cardsDeck|piecesDeck$/) && !newData.child('images/1').exists()) " +
              // toggable and dice have 2 or more images.
              " || (newData.child('elementKind').val().matches(/^toggable|dice$/) && newData.child('images/1').exists()) " +
              // card has exactly 2 images.
              " || (newData.child('elementKind').val() === 'card' && newData.child('images/1').exists() && !newData.child('images/2').exists()) " +
              ")",
          },
        },
        // Stores info about all the game gameSpecs.
        "gameSpecs": {
          "$gameSpecId": {
            ".write": ADD_OR_UPLOADER,
            "uploaderEmail": validateMandatoryEmail(),
            "uploaderUid": validateMyUid(),
            "createdOn": validateNow(),
            "gameName": validateMandatoryString(100), // It's ok if the gameName is not unique.
            "gameIcon50x50": addValidate(validateImageId(), validateImageIdOfSize(50, 50)),
            "gameIcon512x512": addValidate(validateImageId(), validateImageIdOfSize(512, 512)),
            "wikipediaUrl": validateSecureUrl(), // E.g., https://en.wikipedia.org/wiki/Chess
            // Optional tutorial video (it can be an empty string).
            "tutorialYoutubeVideo": validateRegex(`(${YOUTUBE_VIDEO_ID_PATTERN})?`),
            // Info about the board.
            "board": {
              "imageId": addValidate(validateImageId(), validateBoardImage()),
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
                "pieceElementId": validateElementId(),
                "initialState": validatePieceState(),

                // If this piece belongs to a deck, then deckPieceIndex will contain 
                // the pieceIndex of the matching deck.
                // If this piece does not belong to a deck, then store -1.
                "deckPieceIndex": addValidate(validateInteger(-1, 1000),
                  // Checking that if deckPieceIndex is not -1, then this element is a card
                  // and the index points to an element of type deck.
                  `newData.val() === -1 || (` +
                  `root.child('gameBuilder/elements/' + newData.parent().child('pieceElementId').val() + '/elementKind').val() == 'card'` +
                  ` && root.child('gameBuilder/elements/' + newData.parent().parent().child('' + newData.val()).child('pieceElementId').val() + '/elementKind').val().endsWith('Deck')` +
                  `)`),
              },
            },          
          },
        },
      },
      // Stores public and private info about the users of GameBuilder and GamePortal.
      "users": {
        "$userId": {
          ".read": ONLY_ME,
          ".write": ONLY_ME,
          // Contains fields that anyone can read, but only $userId can write.
          "publicFields": {
            ".read": ANYONE,
            "avatarImageUrl": validateSecureUrl(),
            "displayName": validateMandatoryString(100),
            // Whether the user is currently connected or not.
            // You must support a single user having multiple connections: 
            // the user should listen to changes to isConnected,
            // and if it becomes false while the user is still connected,
            // then the user should set it back to true.
            "isConnected": validateBoolean(),
            // Whether the user supports WebRTC or not, e.g.,
            // browsers on iPhones don't support WebRTC.
            // Set to true iff:
            // ['RTCPeerConnection', 'webkitRTCPeerConnection', 'mozRTCPeerConnection', 'RTCIceGatherer'].some((item)=>item in window)
            "supportsWebRTC": validateBoolean(),
            // The timestamp when the user last disconnected from firebase.
            // You can convert it to a date in JS using:
            // new Date(1506721603537)
            // returns
            // Fri Sep 29 2017 17:46:43 GMT-0400 (EDT)
            "lastSeen": validateNow(),
          },
          // Contains fields that only $userId can read&write.
          "privateFields": {
            "email": validateOptionalEmail(),
            "createdOn": validateNow(), // When the user was created.
            "phoneNumber": validateOptionalString(100), // If the user logged in via phone. 
            "facebookId": validateOptionalString(100), // If the user logged in via FB.
            "googleId": validateOptionalString(100), // If the user logged in via Google (see firebase.auth().currentUser.providerData[0].uid).
            "twitterId": validateOptionalString(100), // If the user logged in via Twitter
            "githubId": validateOptionalString(100), // If the user logged in via github (probably same as email).

            // Friends: the set of userIds of your friends in social networks that you used for logging in.
            // E.g., if you logged in via Facebook, then whenever you logged into to GamePortal,
            // we should retrieve your list of Facebook friends,
            // convert those facebookIds to our userIds,
            // and replace this list of friends (because you might have removed/added friends on Facebook).
            "friends": {
              "$friendUserId": validateTrue(),
            },

            "pushNotificationsToken": validateRegex(''), // DEPRECATED: use fcmTokens below.

            // The tokens for sending this user push notifications using FCM (Firebase Cloud Messaging).
            // Push notifications will only be sent using cloud functions, after someone writes to /gamePortal/groups/$groupId/messages/...
            // Currently, the cloud function only sends one push notification using the fcmToken with the latest lastTimeReceived field.
            "fcmTokens": {
              "$fcmToken": {
                "createdOn": validateNow(), // When the token was first added.
                "lastTimeReceived": validateNow(), // The last time we got this token; every time the user opens the app, we should fetch the token and update this lastTimeReceived timestamp.

                // Because of this issue:
                // https://github.com/firebase/quickstart-js/issues/71
                // The notification sent to web or native is different:
                // For native we send both title&body and data in payload:
                // {
                //   notification: {
                //     title: data.title,
                //     body: data.body,
                //   },
                //   data: {
                //     fromUserId: String(data.fromUserId),
                //     toUserId: String(data.toUserId),
                //     groupId: String(data.groupId),
                //     timestamp: String(data.timestamp),
                //   }
                // }
                // For web we send only data in payload:
                // {
                //   data: {
                //     title: data.title,
                //     body: data.body,
                //     fromUserId: String(data.fromUserId),
                //     toUserId: String(data.toUserId),
                //     groupId: String(data.groupId),
                //     timestamp: String(data.timestamp),
                //   }
                // }
                "platform": validateRegex("web|ios|android"),

                // "app" isn't used anywhere, I just added it for easier debugging :)
                "app": validateRegex("GamePortalAngular|GamePortalReact|GamePortalReactNative|GamePortalAndroid"),
              },
            },
          },
          // Contains fields that are private (only $userId can read), but others can add new fields if they’re new (so others can write as long as its new content)
          "privateButAddable": {
            // Groups in which the user is one of the participants/members
            "groups": {
              "$memberOfGroupId": {
                ".write": "!data.exists()",
                "addedByUid": validateMyUid(),
                "timestamp": validateNow(),
              },
            },
            // WebRTC require signalling between two users. 
            // Only show video&audio option if the two users have true in privateFields/supportsWebRTC
            // See https://www.html5rocks.com/en/tutorials/webrtc/basics/
            // Any user can add signals, and only $userId can delete them (after reading the signal).
            // The first message is from the caller and it has signalType='WannaTalk',
            // then the receiver replies with signalType='YesLetsTalk' or signalType='Nope'.
            // These signalTypes don't have any signalData.
            // Then the caller and receiver exchange signalTypes 'sdp' and 'candidate'.
            // The signalData for 'sdp' is the description you get in the callback for createOffer and createAnswer.
            // The signalData for 'candidate' is the event.candidate you get in the callback for onicecandidate.
            "signal": { // // TODO: should be "signals".
              "$signalEntryId": {
                ".write": "!data.exists()",
                "addedByUid": validateMyUid(),
                "timestamp": validateNow(),
                "signalType": validateRegex("WannaTalk|YesLetsTalk|Nope|sdp|candidate"),
                "signalData": validateMandatoryString(10000),
              },
            },
          },
        },
      },
      // Only Game portal should write to this path.
      "gamePortal": {
        // The last 20 users that got connected. 
        // (When a user connects he should add himself, and there is a cloud function that deletes old entries.)
        "recentlyConnected": {
          ".read": ANYONE,
          "$recentlyConnectedEntryId": {
            // Anyone can add a new value (deleting values is done using cloud functions).
            ".write": "!data.exists()",
            "userId": validateMyUid(),
            "timestamp": validateNow(),
          },
        },
        "gameSpec": { // TODO: should be gamesReviews
          // Added by the user
          "reviews": {
            "$reviewedGameSpecId": {
              "$reviewerUserId": {
                ".read": "$reviewerUserId === auth.uid",
                ".write": "$reviewerUserId === auth.uid",
                "timestamp": validateNow(),
                "stars": validateInteger(1, 5),
                // Maybe in the future :)
                //"title": validateMandatoryString(30),
                //"body": validateMandatoryString(1000),
              },
            },
          },
          // Set by cloud functions
          "starsSummary": { // TODO: should be starsSummaries
            ".read": ANYONE,
            "$reviewedGameSpecId": {
              "stars1Count": validateInteger(0, 1000000000),
              "stars2Count": validateInteger(0, 1000000000),
              "stars3Count": validateInteger(0, 1000000000),
              "stars4Count": validateInteger(0, 1000000000),
              "stars5Count": validateInteger(0, 1000000000),
            },
          },
        },
        // All groups of users (2-10 users).
        "groups": {
          "$groupId": {
            // Anyone can create a group, but only the participants can read/modify it
            ".read": "data.child('participants').child(auth.uid).exists()",
            ".write": "!data.exists() || data.child('participants').child(auth.uid).exists()",
            "participants": {
              "$participantUserId": {
                // Some games require giving each participant an index,
                // e.g., Stratego initially shows the black pieces to participantIndex=0
                // and blue pieces to participantIndex=1.
                "participantIndex": validateInteger(0, MAX_USERS_IN_GROUP - 1),
              },
            },
            // An optional name (i.e., groupName can be "").
            "groupName": validateOptionalString(100),
            "createdOn": validateNow(),
            // All the messages ever sent in this group, ordered by time (so newer messages have higher $messageId).
            "messages": {
              // The unique key generated by push() is based on a timestamp, so list items are automatically ordered chronologically.
              "$messageId": {
                "senderUid": validateMyUid(),
                "message": validateMandatoryString(1000),
                "timestamp": validateNow(),
              },
            },
            // I recommend allowing in the UI at most one match in a group,
            // but the DB allows multiple matches.
            "matches": {
              "$matchId": {
                "gameSpecId": validateGameSpecId(),
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
        "userIdIndices": {
          // The $fieldValue in displayName index contains both the full displayName,
          // and also each part of the displayName (broken by white spaces, i.e., first name, middle name, last name, etc).
          "displayName": getUserIdIndex(),
          // The $fieldValue in the indices below is exactly the value stored in the user's /privateFields/XXX.
          "email": getUserIdIndex(),
          "phoneNumber": getUserIdIndex(),
          "facebookId": getUserIdIndex(),
          "googleId": getUserIdIndex(),
          "twitterId": getUserIdIndex(),
          "githubId": getUserIdIndex(),
        }
      },
    };
  }

  function getUserIdIndex(): Rule {
    return {
      // $fieldValue is encoded so that these special characters (".#$/[]")
      // are encoded using "%<ASCII value>", e.g., "]" is encoded as "%5D".
      // You can decode the string using decodeURIComponent, e.g.,
      // decodeURIComponent("%25%2E%23%24%2F%5B%5D") returns "%.#$/[]"
      "$fieldValue": {
        ".read": ANYONE,
        "$userId": validateNow(),
      }
    }
  }

  function getTsType(key: string, rules: any) {
    if (typeof rules == "string") throw new Error("Internal err!");
    if (getNonSpecialKeys(rules).length == 0) {
      let v = rules[".validate"] || '';
      // validateRegex("web|ios|android")
      let regex = getRegexPattern(v);
      if (regex && regex.match(/^(\w+[|])+\w+$/)) {
        return "'" + regex.split('|').join("'|'") + "'";
      }
      return v.indexOf(VALIDATE_NOW) >= 0 ? "number/*firebase.database.ServerValue.TIMESTAMP*/" : v.indexOf('isNumber') >= 0 ? "number" : v.indexOf('isBoolean') >= 0 ? "boolean" : "string";
    }

    // I used the string "images" twice: once for all images (with $imageId) and once for an element images (with $imageIndex)
    if (key == "images" && rules["$imageIndex"]) return "ElementImages";
    //Image already exists: parentKey=$imageIndex old parentKey=$imageId
    if (key == "$imageIndex" && rules["imageId"]) return "ElementImage";
    if (key == "$reviewedGameSpecId") {
      return rules["$reviewerUserId"] ? "StarReviewsForGame" : "StarsSummaryForGame";
    }
    if (key == "$reviewerUserId") return "StarReview";
    if (key == "gameSpec") return "GamesReviews";

    if (key == "pieces" && rules["$pieceIndex"]  && rules["$pieceIndex"]["currentState"]) return "PiecesState";
    if (key == "$pieceIndex" && rules["currentState"]) return "PieceState";

    if (key == "groups" && rules["$memberOfGroupId"]) return "GroupMemberships";
    if (key == "$memberOfGroupId") return "GroupMembership";

    // Make camel case
    let k = key.charAt(0) == '$' ? key.substr(1) : key;
    // Remove Index / Id from the suffix
    if (endsWith(k, 'Index')) k = k.substring(0, k.length - 'Index'.length);
    if (endsWith(k, 'Id')) k = k.substring(0, k.length - 'Id'.length);

    return k.charAt(0).toUpperCase() + k.substr(1) + (rules["$fieldValue"] ? "Index" : "");
  }

  let types: string[] = [];
  let interfaceDefinitions: any = {};
  function createTypeScriptTypes(parentKey: string, rules: any): void {
    if (typeof rules == "string") return;
    if (typeof rules != "object") {
      throw new Error("rules can either be a string or object, but it was: rules=" + rules);
    }
    let keys = getNonSpecialKeys(rules);
    // Remove $other
    if (keys.indexOf('$other') >= 0) keys.splice(keys.indexOf('$other'), 1);

    // recurse
    for (let key of keys) {
      createTypeScriptTypes(key, rules[key]);
    }

    // Add type
    if (keys.length == 0) return;
    let fields: string[] = [];
    if (keys.length > 0 && keys[0].charAt(0) == '$') {
      let repeatedField = keys[0];
      fields.push(`[${repeatedField.substr(1)}: string]: ${getTsType(repeatedField, rules[repeatedField])};`);
    } else {
      for (let key of keys) {
        fields.push(`${key}: ${getTsType(key, rules[key])};`);
      }
    }
    let interfaceName = getTsType(parentKey, rules);
    let interfaceDefinition = `  interface ${interfaceName} {\n    ${fields.join('\n    ')}\n  }`;
    if (interfaceDefinitions[interfaceName] == interfaceDefinition) {
      // already saw this definition.
      return;
    }
    if (interfaceDefinitions[interfaceName]) {
      console.error(`interfaceName=${interfaceName} already exists: parentKey=${parentKey} old definition=${interfaceDefinitions[interfaceName]} rules=${prettyJson(rules)}`);
    }
    interfaceDefinitions[interfaceName] = interfaceDefinition;
    types.push(interfaceDefinition);
  }

  function init() {
    let rules = getRulesJson();
    //console.log(r);
    (<HTMLTextAreaElement>document.getElementById('firebaseRulesTextarea')).value = prettyJson({"rules": rules});
    types.push("declare namespace fbr { // fbr stands for Fire Base Rules");
    createTypeScriptTypes("firebaseDb", rules);
    types.push("}");
    (<HTMLTextAreaElement>document.getElementById('firebaseTypesTextarea')).value = types.join('\n\n');
  }
  init();
}