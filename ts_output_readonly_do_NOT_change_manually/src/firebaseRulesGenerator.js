var firebaseRules;
(function (firebaseRules) {
    function prettyJson(obj) {
        return JSON.stringify(obj, null, '  ');
    }
    function getRulesJson() {
        var rules = getRules();
        addValidateNoOther('', rules);
        return rules;
    }
    function addValidate(rule, exp) {
        rule[".validate"] += " && (" + exp + ")";
        return rule;
    }
    function validate(exp) {
        return {
            ".validate": exp
        };
    }
    function validateOptionalString(maxLengthExclusive) {
        return validateStringLen(0, maxLengthExclusive);
    }
    function validateMandatoryString(maxLengthExclusive) {
        return validateStringLen(1, maxLengthExclusive);
    }
    // maxLength excluding, minLength incuding.
    function validateStringLen(minLengthInclusive, maxLengthExclusive) {
        return validate("newData.isString() && newData.val().length >= " + minLengthInclusive + " && newData.val().length < " + maxLengthExclusive);
    }
    var BEFORE_REGEX = "newData.isString() && newData.val().matches(/^";
    var AFTER_REGEX = "$/)";
    function validateRegex(pattern) {
        return validate("" + BEFORE_REGEX + pattern + AFTER_REGEX);
    }
    function getRegexPattern(validateStr) {
        return beginsWith(validateStr, BEFORE_REGEX) && endsWith(validateStr, AFTER_REGEX) ? validateStr.substring(BEFORE_REGEX.length, validateStr.length - AFTER_REGEX.length) : '';
    }
    function validElementImageProp(prop) {
        return "(newData.parent().parent().parent().child('" + prop + "').val() === root.child('gameBuilder/images/' + newData.val() + '/" + prop + "').val())";
    }
    function validateSecureUrl() {
        return validate("newData.isString() && newData.val().beginsWith(\"https://\") && newData.val().length >= 10 && newData.val().length < 500");
    }
    function validateOptionalEmail() {
        return validateEmail(true);
    }
    function validateMandatoryEmail() {
        return validateEmail(false);
    }
    function validateEmail(allowEmptyString) {
        var allowEmptyCondition = allowEmptyString ? "newData.val() == '' || " : "";
        return validate("newData.isString() && (" + allowEmptyCondition + "newData.val().matches(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,4}$/i))");
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
    var ID_PATTERN = "[-_A-Za-z0-9]{17,40}";
    var YOUTUBE_VIDEO_ID_PATTERN = "[-_A-Za-z0-9]{11}"; // e.g. -FyjEnoIgTM or lWhqORImND0
    function validateImageIdOfSize(width, height) {
        return "root.child('gameBuilder/images/' + newData.val() + '/width').val() === " + width + " && root.child('gameBuilder/images/' + newData.val() + '/height').val() === " + height;
    }
    function validateBoardImage() {
        return "root.child('gameBuilder/images/' + newData.val() + '/isBoardImage').val() === true";
    }
    function validateIdValueExists(path, value) {
        return validate("root.child('" + path + "' + " + value + ").exists()");
    }
    function validateNewDataIdExists(path) {
        return validateIdValueExists(path, 'newData.val()');
    }
    function validateImageId() {
        return validateNewDataIdExists("gameBuilder/images/");
    }
    function validateElementId() {
        return validateNewDataIdExists("gameBuilder/elements/");
    }
    function validateGameSpecId() {
        return validateNewDataIdExists("gameBuilder/gameSpecs/");
    }
    function validateMyUid() {
        return validate("newData.isString() && newData.val() === auth.uid");
    }
    // +1111111111[0-9] is a magical phone number that we can use in our unit tests and manual tests.
    var MAGIC_PHONE_NUMBERS_FOR_TESTS_REGEX = '/^+1111111111[0-9]$/';
    function validateMyPhoneNumber(field) {
        if (field === void 0) { field = "newData.val()"; }
        return validate("(" + field + " === '' || " + field + ".matches(" + MAGIC_PHONE_NUMBERS_FOR_TESTS_REGEX + ") || " + field + " === auth.token.phone_number)");
    }
    var VALIDATE_NOW = "newData.isNumber() && newData.val() == now";
    function validateNow() {
        return validate(
        // messages cannot be added in the past or the future
        // clients must use firebase.database.ServerValue.TIMESTAMP
        // to ensure accurate timestamps
        VALIDATE_NOW);
    }
    function validateBoolean() {
        return validate("newData.isBoolean()");
    }
    function validateTrue() {
        return validate("newData.isBoolean() && newData.val() == true");
    }
    function validateInteger(fromInclusive, toInclusive) {
        return validateNumber(fromInclusive, toInclusive, true);
    }
    function validateNumber(fromInclusive, toInclusive, isInteger) {
        if (isInteger === void 0) { isInteger = false; }
        var intCond = isInteger ? "&& (newData.val() % 1 === 0.0) " : "";
        return validate("newData.isNumber() " + intCond + "&& newData.val() >= " + fromInclusive + " && newData.val() <= " + toInclusive);
    }
    var MAX_IMAGES_IN_ELEMENT = 256;
    var MAX_IMAGES_IN_DECK = 256;
    var MAX_PIECES = 256;
    var MAX_USERS_IN_MATCH = 8;
    function validatePieceState() {
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
            "cardVisibility": {
                "$participantIndex": validateTrue(),
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
                    "lineThickness": validateNumber(0, 100),
                    "fromX": validateNumber(0, 100),
                    "fromY": validateNumber(0, 100),
                    "toX": validateNumber(0, 100),
                    "toY": validateNumber(0, 100),
                },
            },
        };
    }
    function deleteElement(arr, elem) {
        var index = arr.indexOf(elem);
        if (index != -1) {
            if (typeof arr[index] != "string") {
                throw new Error("key " + elem + " must have a string value, but it had the value of " + prettyJson(arr[index]));
            }
            arr.splice(index, 1);
        }
    }
    function getNonSpecialKeys(rule) {
        var keys = Object.keys(rule);
        // remove the special keys: .read, .write, .validate, .indexOn
        deleteElement(keys, ".write");
        deleteElement(keys, ".read");
        deleteElement(keys, ".validate");
        deleteElement(keys, ".indexOn");
        for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
            var key = keys_1[_i];
            if (key.charAt(0) == '.')
                throw new Error("You can't start a property with '.', but you used key=" + key);
        }
        return keys;
    }
    function hasNonCollectionGrandchildren(rules) {
        if (typeof rules == "string")
            throw new Error("Internal error: we traversed into a leaf");
        var allKeys = Object.keys(rules);
        if (allKeys.length == 1 && allKeys[0] == ".validate")
            return true; // leaf
        var keys = getNonSpecialKeys(rules);
        var result = false;
        for (var _i = 0, keys_2 = keys; _i < keys_2.length; _i++) {
            var key = keys_2[_i];
            if (key.charAt(0) != '$') {
                result = result || hasNonCollectionGrandchildren(rules[key]);
            }
        }
        return result;
    }
    function beginsWith(str, searchStr) {
        return str.substr(0, searchStr.length) === searchStr;
    }
    function endsWith(str, searchStr) {
        return str.substr(str.length - searchStr.length, searchStr.length) === searchStr;
    }
    function getValidateIndex(parentKey, maxExclusive) {
        // We can't do:
        // (${parentKey} % 1 === 0.0) && 
        // because convert a string to number in firebase rules (see https://medium.com/front-end-hacking/fun-with-firebase-security-rules-3c0304efa29).
        // I can't even do >= and <=  
        // So we just ensure it's all digits.
        var maxDigitsNum = Math.ceil(Math.log10(maxExclusive));
        return validate(parentKey + ".matches(/^[0-9]{1," + maxDigitsNum + "}$/)");
    }
    function getValidateForParentKey(parentKey) {
        switch (parentKey) {
            case "$participantUserId": return validateIdValueExists("gamePortal/gamePortalUsers/", parentKey);
            case "$deckMemberElementId": return validateIdValueExists("gameBuilder/elements/", parentKey);
            case "$matchMembershipId": return validateIdValueExists("gamePortal/matches/", parentKey);
            case "$imageIndex": return getValidateIndex(parentKey, MAX_IMAGES_IN_ELEMENT);
            case "$pieceIndex": return getValidateIndex(parentKey, MAX_PIECES);
            case "$deckMemberIndex": return getValidateIndex(parentKey, MAX_IMAGES_IN_DECK);
            case "$participantIndex": return getValidateIndex(parentKey, MAX_USERS_IN_MATCH);
            //"elaM4m3sjE0:APA91bHGBqZDfiyl1Hnityy3nE-G-GsC2-guIsGCaT0ua4RPjx-AYr0HSsp2_mzVDaMabKj97vgPq_qqn225gzNHyDIk4ypuAeH4PudoeVgV36TxbhNpRQflo_YEVP8-A9CbiAzHn__S",
            case "$fcmToken": return validate(parentKey + ".matches(/^.{140,200}$/)");
            case "$phoneNumber": return validateMyPhoneNumber("$phoneNumber"); //validate(`${parentKey}.matches(/^[+][0-9]{5,20}$/)`);
            case "$contactPhoneNumber": return validate(parentKey + ".matches(/^[+][0-9]{5,20}$/) || " + parentKey + ".matches(" + MAGIC_PHONE_NUMBERS_FOR_TESTS_REGEX + ")");
            case "$gameBuilderUserId":
            case "$gamePortalUserId":
            case "$imageId":
            case "$elementId":
            case "$gameSpecId":
            case "$messageId":
            case "$matchId":
            case "$signalEntryId":
            case "$lineId":
            case "$gameInfoId":
            case "$gameSpecId":
                return validate(parentKey + ".matches(/^" + ID_PATTERN + "$/)");
        }
        throw new Error("Illegal parentKey=" + parentKey);
    }
    function addValidateNoOther(parentKey, rules) {
        if (typeof rules == "string")
            return;
        if (typeof rules != "object") {
            throw new Error("rules can either be a string or object, but it was: rules=" + rules);
        }
        var keys = getNonSpecialKeys(rules);
        var validateConditions = [];
        if (keys.length > 1 || (keys.length > 0 && keys[0].charAt(0) != '$')) {
            rules["$other"] = { ".validate": false };
            var filteredChildren = keys.filter(function (key) { return hasNonCollectionGrandchildren(rules[key]); });
            if (filteredChildren.length > 0) {
                var quotedChildren = filteredChildren.map(function (val) { return "'" + val + "'"; }).join(", ");
                validateConditions.push("newData.hasChildren([" + quotedChildren + "])");
            }
        }
        if (parentKey.charAt(0) == '$') {
            validateConditions.push(getValidateForParentKey(parentKey)[".validate"]);
        }
        if (validateConditions.length > 0) {
            if (rules[".validate"]) {
                validateConditions.push(rules[".validate"]);
            }
            rules[".validate"] = "(" + validateConditions.join(") && (") + ")";
        }
        if (keys.length > 1) {
            for (var _i = 0, keys_3 = keys; _i < keys_3.length; _i++) {
                var key = keys_3[_i];
                if (key.charAt(0) == '$')
                    throw new Error("You can't use a $ property with other non-$ properties, but you have these keys=" + keys);
            }
        }
        // recurse
        for (var _a = 0, keys_4 = keys; _a < keys_4.length; _a++) {
            var key = keys_4[_a];
            addValidateNoOther(key, rules[key]);
        }
    }
    var ANYONE = "auth != null";
    // Anyone can add a new image,
    // but not delete/modify values (only the uploader can change anything).
    // TODO: I allow anyone to update the game specs in Gamebuilder because we need to fix many games.
    var ADD_OR_UPLOADER = ANYONE; //  "!data.exists() || data.child('uploaderUid').val() == auth.uid";
    function getImage() {
        return {
            ".write": ADD_OR_UPLOADER,
            ".validate": "newData.child('isBoardImage').val() === false || newData.child('width').val() === 1024 || newData.child('height').val() === 1024",
            "uploaderEmail": validateMandatoryEmail(),
            "uploaderUid": validateMyUid(),
            "createdOn": validateNow(),
            "width": validateNumber(10, 1024),
            "height": validateNumber(10, 1024),
            "isBoardImage": validateBoolean(),
            "downloadURL": validateSecureUrl(),
            "sizeInBytes": validateNumber(100, 2 * 1024 * 1024),
            "cloudStoragePath": validateRegex("images\\/" + ID_PATTERN + "[.](gif|png|jpg)"),
            "name": validateMandatoryString(100),
        };
    }
    function getElement() {
        return {
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
                    "imageId": addValidate(validateImageId(), validElementImageProp('width') + " && " + validElementImageProp('height')),
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
        };
    }
    function getGameSpec() {
        return {
            ".write": ADD_OR_UPLOADER,
            "uploaderEmail": validateMandatoryEmail(),
            "uploaderUid": validateMyUid(),
            "createdOn": validateNow(),
            "gameName": validateMandatoryString(100),
            "gameIcon50x50": addValidate(validateImageId(), validateImageIdOfSize(50, 50)),
            "gameIcon512x512": addValidate(validateImageId(), validateImageIdOfSize(512, 512)),
            "screenShotImageId": validateOptionalString(1000),
            "wikipediaUrl": validateSecureUrl(),
            // Optional tutorial video (it can be an empty string).
            "tutorialYoutubeVideo": validateRegex("(" + YOUTUBE_VIDEO_ID_PATTERN + ")?"),
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
                    "newData.val() === -1 || (" +
                        "root.child('gameBuilder/elements/' + newData.parent().child('pieceElementId').val() + '/elementKind').val() == 'card'" +
                        " && root.child('gameBuilder/elements/' + newData.parent().parent().child('' + newData.val()).child('pieceElementId').val() + '/elementKind').val().endsWith('Deck')" +
                        ")"),
                },
            },
        };
    }
    /*
    - permission cascades down:
        once you've granted read or write permission on a certain level in the tree,
        you cannot take that permission away at a lower level.
    - .validate rules are different:
        data is only considered valid when all validation rules are met.
        (http://stackoverflow.com/questions/39082513/catch-all-other-firebase-database-rule)
  
    Docs: https://firebase.google.com/docs/reference/security/database/
    */
    function getRules() {
        return {
            ".read": "false",
            ".write": "false",
            // Data in gameBuilder should only be written by GameBuilder (not GamePortal).
            // Anyone can read.
            "gameBuilder": {
                ".read": ANYONE,
                "images": {
                    ".indexOn": ["isBoardImage"],
                    "$imageId": getImage(),
                },
                "elements": {
                    "$elementId": getElement(),
                },
                // Stores info about all the game gameSpecs.
                "gameSpecs": {
                    "$gameSpecId": getGameSpec(),
                },
                // Stores the users of GameBuilder ONLY. All the info is private just for that user.
                "gameBuilderUsers": {
                    "$gameBuilderUserId": {
                        ".read": "$gameBuilderUserId === auth.uid",
                        ".write": "$gameBuilderUserId === auth.uid",
                        "avatarImageUrl": validateSecureUrl(),
                        "displayName": validateMandatoryString(100),
                        // The timestamp when the user last disconnected from firebase.
                        // You can convert it to a date in JS using:
                        // new Date(1506721603537)
                        // returns
                        // Fri Sep 29 2017 17:46:43 GMT-0400 (EDT)
                        "lastSeen": validateNow(),
                        "email": validateOptionalEmail(),
                        "createdOn": validateNow(),
                    },
                },
            },
            "testPushNotification": {
                ".write": "true",
                ".validate": validateMandatoryString(1000)[".validate"],
            },
            // Only Game portal should write to this path.
            "gamePortal": {
                "gamesInfoAndSpec": {
                    ".read": ANYONE,
                    // TODO: Will be written by cloud functions
                    "gameInfos": {
                        "$gameInfoId": {
                            "gameSpecId": validateMandatoryString(100),
                            "gameName": validateMandatoryString(100),
                            "screenShotImageId": validateMandatoryString(100),
                            "screenShotImage": getImage(),
                            "wikipediaUrl": validateSecureUrl(),
                        },
                    },
                    "gameSpecsForPortal": {
                        "$gameSpecId": {
                            "images": {
                                "$imageId": getImage(),
                            },
                            "elements": {
                                "$elementId": getElement(),
                            },
                            // Stores info about all the game gameSpecs.
                            "gameSpec": getGameSpec(),
                        },
                    },
                },
                // Maps international phone numbers to userIds.
                "phoneNumberToUserId": {
                    // $phoneNumber is an international number, i.e., (/^[+][0-9]{5,20}$/)
                    "$phoneNumber": {
                        ".read": ANYONE,
                        ".write": validateMyPhoneNumber("$phoneNumber")['.validate'],
                        "userId": validateMyUid(),
                        "timestamp": validateNow(),
                    },
                },
                // Stores the users of GamePortal ONLY (not GameBuilder users).
                "gamePortalUsers": {
                    "$gamePortalUserId": {
                        ".read": "$gamePortalUserId === auth.uid",
                        ".write": "$gamePortalUserId === auth.uid",
                        "publicFields": {
                            ".read": ANYONE,
                            "displayName": validateOptionalString(50),
                        },
                        // Contains fields that only $userId can read&write.
                        "privateFields": {
                            "createdOn": validateNow(),
                            "countryCode": validateOptionalString(3),
                            "phoneNumber": validateMyPhoneNumber(),
                            "contacts": {
                                "$contactPhoneNumber": {
                                    "contactName": validateMandatoryString(20),
                                },
                            },
                            // The tokens for sending this user push notifications using FCM (Firebase Cloud Messaging).
                            // Push notifications will only be sent using cloud functions, after someone writes to
                            // /gamePortal/matches/$matchId/participants/$participantUserId/pingOpponents
                            // Currently, the cloud function only sends one push notification using the fcmToken with the latest lastTimeReceived field.
                            "fcmTokens": {
                                "$fcmToken": {
                                    // The last time we got this token; 
                                    // every time the user opens the app, 
                                    // we should fetch the token and update this lastTimeReceived timestamp.
                                    "lastTimeReceived": validateNow(),
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
                                    //     matchId: String(data.matchId),
                                    //     timestamp: String(data.timestamp),
                                    //   }
                                    // }
                                    // For web we send only data in payload.
                                    "platform": validateRegex("web|ios|android"),
                                },
                            },
                        },
                        // Contains fields that are private (only $userId can read),
                        // but others can add new fields if they’re new
                        // (so others can write as long as its new content)
                        "privateButAddable": {
                            "matchMemberships": {
                                "$matchMembershipId": {
                                    ".write": "!data.exists()",
                                    "addedByUid": validateMyUid(),
                                    "timestamp": validateNow(),
                                },
                            },
                            // WebRTC require signalling between two users. 
                            // Only show video&audio option if the two users have true in privateFields/supportsWebRTC
                            // See https://www.html5rocks.com/en/tutorials/webrtc/basics/
                            // Any user can add signals, and only $userId can delete them (after reading the signal).
                            // Then the caller and receiver exchange signals.
                            // The signalData for 'sdp1|sdp2' is the description you get in the callback for createOffer (sdp1) and createAnswer (sdp2).
                            // The signalData for 'candidate' is the event.candidate you get in the callback for onicecandidate.
                            "signals": {
                                "$signalEntryId": {
                                    ".write": "!data.exists() || data.child('addedByUid').val() == auth.uid",
                                    "addedByUid": validateMyUid(),
                                    "timestamp": validateNow(),
                                    "signalType": validateRegex("sdp1|sdp2|candidate"),
                                    "signalData": validateMandatoryString(10000),
                                },
                            },
                        },
                    },
                },
                "matches": {
                    "$matchId": {
                        // Anyone can create a match, but only the participants can read/modify it
                        ".read": "data.child('participants').child(auth.uid).exists()",
                        ".write": "!data.exists() || data.child('participants').child(auth.uid).exists()",
                        "participants": {
                            "$participantUserId": {
                                // Some games require giving each participant an index,
                                // e.g., Stratego initially shows the black pieces to participantIndex=0
                                // and blue pieces to participantIndex=1.
                                "participantIndex": validateInteger(0, MAX_USERS_IN_MATCH - 1),
                                // Update pingOpponents whenever you enter a match so all opponents
                                // will get a push notification that you're calling.
                                // (Obviously, no need to do it in single-player matches, i.e., when you're the only participant.)
                                "pingOpponents": validateNow(),
                            },
                        },
                        "createdOn": validateNow(),
                        "lastUpdatedOn": validateNow(),
                        "gameSpecId": validateGameSpecId(),
                        "pieces": {
                            "$pieceIndex": {
                                "currentState": validatePieceState(),
                            },
                        },
                    },
                },
            },
        };
    }
    function getTsType(key, rules) {
        if (typeof rules == "string")
            throw new Error("Internal err!");
        if (getNonSpecialKeys(rules).length == 0) {
            var v = rules[".validate"] || '';
            // validateRegex("web|ios|android")
            var regex = getRegexPattern(v);
            if (regex && regex.match(/^(\w+[|])+\w+$/)) {
                return "'" + regex.split('|').join("'|'") + "'";
            }
            return v.indexOf(VALIDATE_NOW) >= 0 ? "number /*firebase.database.ServerValue.TIMESTAMP*/" : v.indexOf('isNumber') >= 0 ? "number" : v.indexOf('isBoolean') >= 0 ? "boolean" : "string";
        }
        // I used the string "images" twice: once for all images (with $imageId) and once for an element images (with $imageIndex)
        if (key == "images" && rules["$imageIndex"])
            return "ElementImages";
        //Image already exists: parentKey=$imageIndex old parentKey=$imageId
        if (key == "$imageIndex" && rules["imageId"])
            return "ElementImage";
        if (key == "$gameSpecId" && rules["images"])
            return "GameSpecForPortal";
        if (key == "pieces" && rules["$pieceIndex"] && rules["$pieceIndex"]["currentState"])
            return "PiecesState";
        if (key == "$pieceIndex" && rules["currentState"])
            return "PieceState";
        // Make camel case
        var k = key.charAt(0) == '$' ? key.substr(1) : key;
        // Remove Index / Id from the suffix
        if (endsWith(k, 'Index'))
            k = k.substring(0, k.length - 'Index'.length);
        if (endsWith(k, 'Id'))
            k = k.substring(0, k.length - 'Id'.length);
        return k.charAt(0).toUpperCase() + k.substr(1);
    }
    var types = [];
    var interfaceDefinitions = {};
    function createTypeScriptTypes(parentKey, rules) {
        if (typeof rules == "string")
            return;
        if (typeof rules != "object") {
            throw new Error("rules can either be a string or object, but it was: rules=" + rules);
        }
        var keys = getNonSpecialKeys(rules);
        // Remove $other
        if (keys.indexOf('$other') >= 0)
            keys.splice(keys.indexOf('$other'), 1);
        // recurse
        for (var _i = 0, keys_5 = keys; _i < keys_5.length; _i++) {
            var key = keys_5[_i];
            createTypeScriptTypes(key, rules[key]);
        }
        // Add type
        if (keys.length == 0)
            return;
        var fields = [];
        if (keys.length > 0 && keys[0].charAt(0) == '$') {
            var repeatedField = keys[0];
            fields.push("[" + repeatedField.substr(1) + ": string]: " + getTsType(repeatedField, rules[repeatedField]) + ";");
        }
        else {
            for (var _a = 0, keys_6 = keys; _a < keys_6.length; _a++) {
                var key = keys_6[_a];
                fields.push(key + ": " + getTsType(key, rules[key]) + ";");
            }
        }
        var interfaceName = getTsType(parentKey, rules);
        var interfaceDefinition = "  interface " + interfaceName + " {\n    " + fields.join('\n    ') + "\n  }";
        if (interfaceDefinitions[interfaceName] == interfaceDefinition) {
            // already saw this definition.
            return;
        }
        if (interfaceDefinitions[interfaceName]) {
            console.error("interfaceName=" + interfaceName + " already exists: parentKey=" + parentKey + " old definition=" + interfaceDefinitions[interfaceName] + " rules=" + prettyJson(rules));
        }
        interfaceDefinitions[interfaceName] = interfaceDefinition;
        types.push(interfaceDefinition);
    }
    function init() {
        var rules = getRulesJson();
        //console.log(r);
        document.getElementById('firebaseRulesTextarea').value = prettyJson({ "rules": rules });
        types.push("declare namespace fbr { // fbr stands for Fire Base Rules");
        createTypeScriptTypes("firebaseDb", rules);
        types.push("}");
        document.getElementById('firebaseTypesTextarea').value = types.join('\n\n');
    }
    init();
})(firebaseRules || (firebaseRules = {}));
//# sourceMappingURL=firebaseRulesGenerator.js.map