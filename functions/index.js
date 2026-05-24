// Point d'entrée Cloud Functions Firebase
const socialNotifPush = require('./social-notif-push');

exports.onSocialNotif = socialNotifPush.onSocialNotif;
