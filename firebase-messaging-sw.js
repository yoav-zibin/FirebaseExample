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
data in push notification:
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

self.addEventListener('push', function(event) {
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
    badge: 'imgs/firebase-logo.png',  // (the badge is only used on Android at the time of writing). see https://developers.google.com/web/fundamentals/codelabs/push-notifications/#notification_click
    data: payload.data, // So we can use the data in notificationclick handler.
  };

  console.log("options=", options);
  event.waitUntil(self.registration.showNotification(payload.data.title, options));
});
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click Received. Notification data=', event.notification.data);

  event.notification.close();

  // TODO: only open a new window if there isn't a window with your app that's already opened.
  // https://developers.google.com/web/updates/2015/03/push-notifications-on-the-open-web#opening_a_url_when_the_user_clicks_a_notification
  // "This example opens the browser to the root of the site's origin, by focusing an existing same-origin tab if one exists, and otherwise opening a new one."
  // TODO: make sure you handle the foreground case correctly, i.e., 
  event.waitUntil(
    clients.openWindow('https://developers.google.com/web/updates/2015/03/push-notifications-on-the-open-web#opening_a_url_when_the_user_clicks_a_notification')
  );
});

// Never called if I send notification with title&body,
// and even if it is called, there is no way to show a notification and later handle notificationclick.
// Fucking crazy: https://github.com/firebase/quickstart-js/issues/71
messaging.setBackgroundMessageHandler(function(payload) {
  console.log("[firebase-messaging-sw.js] setBackgroundMessageHandler: Received background message payload=', payload, ' not doing anything in this method because we handle it in self.addEventListener('push', ...) above");
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