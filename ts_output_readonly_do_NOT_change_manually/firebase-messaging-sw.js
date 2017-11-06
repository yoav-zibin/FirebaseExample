// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here, other Firebase libraries
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/3.9.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/3.9.0/firebase-messaging.js');
// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
firebase.initializeApp({
    'messagingSenderId': '144595629077'
});
// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();
/*
data in WEB push notification:
{
  "from": "144595629077",
  "collapse_key": "do_not_collapse",
  "data": {
    "fromUserId": "gB1U37z4WxRLIJ7u5SyyILMqu883",
    "groupId": "-KyGuWzhHowFyUhiisef",
    "toUserId": "gB1U37z4WxRLIJ7u5SyyILMqu883",
    "timestamp": "1509981653309",
    "title": "title",
    "body": "body"
  },
}
*/
self.addEventListener('push', function (/** @type {any} */ event) {
    if (!event.data) {
        console.error("No event.data!, event=", event);
        return;
    }
    console.log(`[firebase-messaging-sw.js] Push Received with this data: "${event.data.text()}"`);
    /*
    payload is
    {
      "from": "144595629077",
      "collapse_key": "do_not_collapse",
      "data": {
        "fromUserId": "gB1U37z4WxRLIJ7u5SyyILMqu883",
        "groupId": "-KyGuWzhHowFyUhiisef",
        "title": "title",
        "body": "body",
        "toUserId": "gB1U37z4WxRLIJ7u5SyyILMqu883",
        "timestamp": "1509989690668"
      }
    }
    */
    var payload = event.data.json();
    console.log("payload=", payload);
    if (!payload || !payload.data || !payload.data.title || !payload.data.body) {
        console.error("No title or body! payload=", payload);
        return;
    }
    // See options in https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification
    const options = {
        body: payload.data.body,
        icon: 'imgs/firebase-logo.png',
        badge: 'imgs/firebase-logo.png',
        data: payload.data,
    };
    console.log("options=", options);
    // If the app is in the foreground (with focus), then we handle it in main JS, see messaging().onMessage(function(payload: any) {...})
    // Se we need to detect it.
    event.waitUntil(clients.matchAll({
        type: "window",
        includeUncontrolled: true
    }).then(function (/** @type {any[]} */ clientList) {
        for (var i = 0; i < clientList.length; i++) {
            var client = clientList[i];
            if ("visible" === client.visibilityState) {
                console.log('client=', client, ' in foreground, so not showing notification');
                // Passing a message to the main JS thread.
                // https://developer.mozilla.org/en-US/docs/Web/API/Client/postMessage
                client.postMessage(payload.data);
                return;
            }
        }
        ;
        /** @type {any} */
        let selfAnyType = self;
        return selfAnyType.registration.showNotification(payload.data.title, options);
    }));
});
self.addEventListener('notificationclick', function (/** @type {any} */ event) {
    let data = event.notification.data;
    console.log('[firebase-messaging-sw.js] Notification click Received. Notification data=', data);
    event.notification.close();
    // "This example opens the browser to the root of the site's origin, by focusing an existing same-origin tab if one exists, and otherwise opening a new one."
    // https://developers.google.com/web/updates/2015/03/push-notifications-on-the-open-web#opening_a_url_when_the_user_clicks_a_notification
    event.waitUntil(clients.matchAll({
        type: "window"
    })
        .then(function (/** @type {any} */ clientList) {
        for (var i = 0; i < clientList.length; i++) {
            var client = clientList[i];
            if ('focus' in client) {
                console.log('client=', client, ' can be focused, so not opening a new window');
                // Passing a message to the main JS thread.
                // https://developer.mozilla.org/en-US/docs/Web/API/Client/postMessage
                client.postMessage(data);
                // https://stackoverflow.com/questions/30302636/clients-openwindow-not-allowed-to-open-a-window-on-a-serviceworker-google-c
                // clients.openWindow() and windowClient.focus() are only allowed after clicking the notification (in Chrome 47 at least), and at most one of these methods can be called, for the duration of the click handler. This behavior was specified in https://github.com/slightlyoff/ServiceWorker/issues/602.
                return client.focus();
            }
        }
        if (clients.openWindow) {
            return clients.openWindow(`firebasePushNotifications.html?groupId=${data.groupId}&timestamp=${data.timestamp}&fromUserId=${data.fromUserId}`);
        }
    }));
});
// Never called if I send notification with title&body,
// and even if it is called, there is no way to show a notification and later handle notificationclick.
// Fucking crazy: https://github.com/firebase/quickstart-js/issues/71
messaging.setBackgroundMessageHandler(function (/** @type {any} */ payload) {
    console.log("[firebase-messaging-sw.js] setBackgroundMessageHandler: Received background message payload=", payload, " not doing anything in this method because we handle it in self.addEventListener('push', ...) above");
    // So, doing nothing because of these issues.
    /*const notificationTitle = 'Background Message Title';
    const notificationOptions = {
      body: 'Background Message body.',
      icon: 'imgs/firebase-logo.png'
    };
  
    return self.registration.showNotification(notificationTitle,
        notificationOptions);
    */
});
//# sourceMappingURL=firebase-messaging-sw.js.map