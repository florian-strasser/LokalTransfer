// Translations for outgoing e-mail.
//
// Kept separate from the client-side i18n messages on purpose: mail is rendered
// on the server, often from a scheduled task with no request context, so it
// can't reach into the Vue i18n instance. The active language comes from
// NUXT_LANGUAGE, since a transfer's recipient is frequently someone who has
// never visited the app and has no locale preference of their own.
//
// Ten languages, the same ten as the interface. Every table below is typed
// against the English one, so a missing or misspelled key is a build error
// rather than a string that silently falls back at runtime.
import { LOCALE_TAGS, isLocale, pluralIndex, type Locale } from '../../app/utils/locales'

export type EmailLanguage = Locale

/** Placeholders are `{name}`; unknown keys are left untouched. */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match)
}

const en = {
  // --- A transfer has arrived -------------------------------------------------
  transferSubject: '{sender} sent you files',
  transferSubjectNamed: '{sender} sent you files: {subject}',
  transferPreheader: '{count} file, available until {expiry} | {count} files, available until {expiry}',
  transferPreheaderUnlimited: '{count} file, no expiry date | {count} files, no expiry date',
  transferHeading: 'You have received files',
  transferIntro: '<strong>{sender}</strong> has sent you {count} file via {appName}. | <strong>{sender}</strong> has sent you {count} files via {appName}.',
  transferButton: 'Download files',
  transferExpiry: 'These files are available until <strong>{expiry}</strong>. After that they are permanently deleted from the server.',
  transferExpiryUnlimited: 'These files have no expiry date.',
  transferFooter: 'You received this e-mail because {sender} sent you files through {appName}.',

  // --- Copy to the sender -----------------------------------------------------
  receiptSubject: 'Your transfer has been sent',
  receiptPreheader: 'Sent to {recipients}',
  receiptHeading: 'Your transfer is on its way',
  receiptIntro: 'Your file has been sent to <strong>{recipients}</strong>. | Your {count} files have been sent to <strong>{recipients}</strong>.',
  receiptButton: 'View transfer',
  receiptFooter: 'You are receiving this because you created the transfer.',

  // --- The transfer is about to lapse ----------------------------------------
  expiryWarningSubject: 'Your transfer expires soon',
  expiryWarningSubjectNamed: 'Your transfer expires soon: {subject}',
  expiryWarningPreheader: 'Expires {expiry} — after that the files are gone',
  expiryWarningHeading: 'This transfer is about to expire',
  expiryWarningIntro: 'The file you sent on {sent} will stop being available shortly. | The {count} files you sent on {sent} will stop being available shortly.',
  expiryWarningRecipients: 'Sent to <strong>{recipients}</strong>.',
  expiryWarningLinkOnly: 'This is a link-only transfer, so nobody was notified by e-mail — only whoever you gave the link to can reach it.',
  expiryWarningNotDownloaded: 'It has not been downloaded yet.',
  expiryWarningDownloaded: 'It has been downloaded {count} time. | It has been downloaded {count} times.',
  expiryWarningDeadline: 'On <strong>{expiry}</strong> the link stops working and the files are permanently deleted from the server. This cannot be undone.',
  expiryWarningAction: 'If they are still needed, download them now or send them again.',
  expiryWarningButton: 'Open transfer',
  expiryWarningFooter: 'You are receiving this because you created the transfer. It is sent once, shortly before the files are deleted.',

  // --- A guest dropped files off ---------------------------------------------
  guestSubject: '{sender} sent you files',
  guestPreheader: '{count} file received from {sender} | {count} files received from {sender}',
  guestHeading: 'Files received',
  guestIntro: '<strong>{sender}</strong>{company} has uploaded {count} file for you. | <strong>{sender}</strong>{company} has uploaded {count} files for you.',
  guestFooter: 'You received this because you were chosen as the recipient of a guest upload.',

  // --- Magic link -------------------------------------------------------------
  magicSubject: 'Your sign-in link for {appName}',
  magicPreheader: 'The link is valid for {minutes} minutes',
  magicHeading: 'Your sign-in link',
  magicIntro: 'Use the button below to sign in to {appName} and upload files. The link is valid for {minutes} minutes and can only be used once.',
  magicButton: 'Sign in and upload',
  magicIgnore: 'If you did not request this link, you can simply ignore this e-mail.',

  // --- Account created by an admin -------------------------------------------
  welcomeSubject: 'Your access to {appName}',
  welcomePreheader: 'Your account has been created',
  welcomeHeading: 'Welcome to {appName}',
  welcomeIntro: 'Hello {name}, an account has been created for you by {adminName}.',
  welcomeCredentials: 'E-mail: <strong>{email}</strong>\nPassword: <strong>{password}</strong>',
  welcomeChange: 'Please change this password after your first sign-in.',
  welcomeButton: 'Sign in',

  // --- Guest account created --------------------------------------------------
  guestWelcomeSubject: 'You can now send files to {appName}',
  guestWelcomePreheader: 'Request a link any time to upload files',
  guestWelcomeHeading: 'Send us your files',
  guestWelcomeIntro: 'Hello {name}, you can now send files to us securely. You do not need a password: enter your e-mail address on the page below and you will receive a one-time sign-in link.',
  guestWelcomeButton: 'Send files',

  // --- Password reset ---------------------------------------------------------
  resetSubject: 'Reset your password',
  resetPreheader: 'The link is valid for 24 hours',
  resetHeading: 'Reset your password',
  resetIntro: 'A password reset was requested for your {appName} account. The link is valid for 24 hours.',
  resetButton: 'Choose a new password',
  resetIgnore: 'If you did not request this, you can ignore this e-mail — your password stays unchanged.',

  // --- Shared -----------------------------------------------------------------
  messageFrom: 'Message from {sender}:',
  totalSize: '{count} file · {size} | {count} files · {size}'
}

const de: typeof en = {
  transferSubject: '{sender} hat Ihnen Dateien gesendet',
  transferSubjectNamed: '{sender} hat Ihnen Dateien gesendet: {subject}',
  transferPreheader: '{count} Datei, verfügbar bis {expiry} | {count} Dateien, verfügbar bis {expiry}',
  transferPreheaderUnlimited: '{count} Datei, ohne Ablaufdatum | {count} Dateien, ohne Ablaufdatum',
  transferHeading: 'Sie haben Dateien erhalten',
  transferIntro: '<strong>{sender}</strong> hat Ihnen {count} Datei über {appName} gesendet. | <strong>{sender}</strong> hat Ihnen {count} Dateien über {appName} gesendet.',
  transferButton: 'Dateien herunterladen',
  transferExpiry: 'Die Dateien stehen bis zum <strong>{expiry}</strong> zur Verfügung. Danach werden sie unwiderruflich vom Server gelöscht.',
  transferExpiryUnlimited: 'Diese Dateien haben kein Ablaufdatum.',
  transferFooter: 'Sie erhalten diese E-Mail, weil {sender} Ihnen Dateien über {appName} gesendet hat.',

  receiptSubject: 'Ihre Übertragung wurde versendet',
  receiptPreheader: 'Gesendet an {recipients}',
  receiptHeading: 'Ihre Übertragung ist unterwegs',
  receiptIntro: 'Ihre Datei wurde an <strong>{recipients}</strong> gesendet. | Ihre {count} Dateien wurden an <strong>{recipients}</strong> gesendet.',
  receiptButton: 'Übertragung ansehen',
  receiptFooter: 'Sie erhalten diese E-Mail, weil Sie die Übertragung erstellt haben.',

  expiryWarningSubject: 'Ihre Übertragung läuft bald ab',
  expiryWarningSubjectNamed: 'Ihre Übertragung läuft bald ab: {subject}',
  expiryWarningPreheader: 'Läuft am {expiry} ab — danach sind die Dateien gelöscht',
  expiryWarningHeading: 'Diese Übertragung läuft bald ab',
  expiryWarningIntro: 'Die Datei, die Sie am {sent} gesendet haben, ist bald nicht mehr verfügbar. | Die {count} Dateien, die Sie am {sent} gesendet haben, sind bald nicht mehr verfügbar.',
  expiryWarningRecipients: 'Gesendet an <strong>{recipients}</strong>.',
  expiryWarningLinkOnly: 'Dies ist eine Übertragung ohne Empfänger — es wurde niemand per E-Mail benachrichtigt. Nur wer den Link von Ihnen erhalten hat, kann darauf zugreifen.',
  expiryWarningNotDownloaded: 'Sie wurde bisher nicht heruntergeladen.',
  expiryWarningDownloaded: 'Sie wurde bisher {count}-mal heruntergeladen. | Sie wurde bisher {count}-mal heruntergeladen.',
  expiryWarningDeadline: 'Am <strong>{expiry}</strong> wird der Link ungültig und die Dateien werden endgültig vom Server gelöscht. Das lässt sich nicht rückgängig machen.',
  expiryWarningAction: 'Falls Sie die Dateien noch brauchen, laden Sie sie jetzt herunter oder senden Sie sie erneut.',
  expiryWarningButton: 'Übertragung öffnen',
  expiryWarningFooter: 'Sie erhalten diese E-Mail, weil Sie die Übertragung erstellt haben. Sie wird einmalig kurz vor dem Löschen der Dateien versendet.',

  guestSubject: '{sender} hat Ihnen Dateien gesendet',
  guestPreheader: '{count} Datei von {sender} erhalten | {count} Dateien von {sender} erhalten',
  guestHeading: 'Dateien erhalten',
  guestIntro: '<strong>{sender}</strong>{company} hat {count} Datei für Sie hochgeladen. | <strong>{sender}</strong>{company} hat {count} Dateien für Sie hochgeladen.',
  guestFooter: 'Sie erhalten diese E-Mail, weil Sie als Empfänger eines Gast-Uploads ausgewählt wurden.',

  magicSubject: 'Ihr Anmeldelink für {appName}',
  magicPreheader: 'Der Link ist {minutes} Minuten gültig',
  magicHeading: 'Ihr Anmeldelink',
  magicIntro: 'Melden Sie sich über die Schaltfläche unten bei {appName} an, um Dateien hochzuladen. Der Link ist {minutes} Minuten gültig und kann nur einmal verwendet werden.',
  magicButton: 'Anmelden und hochladen',
  magicIgnore: 'Wenn Sie diesen Link nicht angefordert haben, können Sie diese E-Mail ignorieren.',

  welcomeSubject: 'Ihr Zugang zu {appName}',
  welcomePreheader: 'Ihr Konto wurde angelegt',
  welcomeHeading: 'Willkommen bei {appName}',
  welcomeIntro: 'Hallo {name}, {adminName} hat ein Konto für Sie angelegt.',
  welcomeCredentials: 'E-Mail: <strong>{email}</strong>\nPasswort: <strong>{password}</strong>',
  welcomeChange: 'Bitte ändern Sie dieses Passwort nach der ersten Anmeldung.',
  welcomeButton: 'Anmelden',

  guestWelcomeSubject: 'Sie können ab sofort Dateien an {appName} senden',
  guestWelcomePreheader: 'Fordern Sie jederzeit einen Link zum Hochladen an',
  guestWelcomeHeading: 'Senden Sie uns Ihre Dateien',
  guestWelcomeIntro: 'Hallo {name}, Sie können uns ab sofort sicher Dateien senden. Sie benötigen kein Passwort: Geben Sie auf der folgenden Seite Ihre E-Mail-Adresse ein und Sie erhalten einen einmaligen Anmeldelink.',
  guestWelcomeButton: 'Dateien senden',

  resetSubject: 'Passwort zurücksetzen',
  resetPreheader: 'Der Link ist 24 Stunden gültig',
  resetHeading: 'Passwort zurücksetzen',
  resetIntro: 'Für Ihr Konto bei {appName} wurde ein neues Passwort angefordert. Der Link ist 24 Stunden gültig.',
  resetButton: 'Neues Passwort wählen',
  resetIgnore: 'Falls Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren — Ihr Passwort bleibt unverändert.',

  messageFrom: 'Nachricht von {sender}:',
  totalSize: '{count} Datei · {size} | {count} Dateien · {size}'
}

const fr: typeof en = {
  transferSubject: '{sender} vous a envoyé des fichiers',
  transferSubjectNamed: '{sender} vous a envoyé des fichiers : {subject}',
  transferPreheader: '{count} fichier, disponible jusqu\'au {expiry} | {count} fichiers, disponibles jusqu\'au {expiry}',
  transferPreheaderUnlimited: '{count} fichier, sans date d\'expiration | {count} fichiers, sans date d\'expiration',
  transferHeading: 'Vous avez reçu des fichiers',
  transferIntro: '<strong>{sender}</strong> vous a envoyé {count} fichier via {appName}. | <strong>{sender}</strong> vous a envoyé {count} fichiers via {appName}.',
  transferButton: 'Télécharger les fichiers',
  transferExpiry: 'Ces fichiers sont disponibles jusqu\'au <strong>{expiry}</strong>. Passé cette date, ils sont définitivement supprimés du serveur.',
  transferExpiryUnlimited: 'Ces fichiers n\'ont pas de date d\'expiration.',
  transferFooter: 'Vous recevez cet e-mail parce que {sender} vous a envoyé des fichiers via {appName}.',

  receiptSubject: 'Votre transfert a été envoyé',
  receiptPreheader: 'Envoyé à {recipients}',
  receiptHeading: 'Votre transfert est en route',
  receiptIntro: 'Votre fichier a été envoyé à <strong>{recipients}</strong>. | Vos {count} fichiers ont été envoyés à <strong>{recipients}</strong>.',
  receiptButton: 'Voir le transfert',
  receiptFooter: 'Vous recevez cet e-mail parce que vous avez créé le transfert.',

  expiryWarningSubject: 'Votre transfert expire bientôt',
  expiryWarningSubjectNamed: 'Votre transfert expire bientôt : {subject}',
  expiryWarningPreheader: 'Expire le {expiry} — ensuite, les fichiers sont supprimés',
  expiryWarningHeading: 'Ce transfert est sur le point d\'expirer',
  expiryWarningIntro: 'Le fichier que vous avez envoyé le {sent} ne sera bientôt plus disponible. | Les {count} fichiers que vous avez envoyés le {sent} ne seront bientôt plus disponibles.',
  expiryWarningRecipients: 'Envoyé à <strong>{recipients}</strong>.',
  expiryWarningLinkOnly: 'Il s\'agit d\'un transfert par lien uniquement : personne n\'a été prévenu par e-mail, seules les personnes à qui vous avez donné le lien peuvent y accéder.',
  expiryWarningNotDownloaded: 'Il n\'a pas encore été téléchargé.',
  expiryWarningDownloaded: 'Il a été téléchargé {count} fois. | Il a été téléchargé {count} fois.',
  expiryWarningDeadline: 'Le <strong>{expiry}</strong>, le lien cessera de fonctionner et les fichiers seront définitivement supprimés du serveur. Cette action est irréversible.',
  expiryWarningAction: 'Si vous en avez encore besoin, téléchargez-les maintenant ou envoyez-les à nouveau.',
  expiryWarningButton: 'Ouvrir le transfert',
  expiryWarningFooter: 'Vous recevez cet e-mail parce que vous avez créé le transfert. Il est envoyé une seule fois, peu avant la suppression des fichiers.',

  guestSubject: '{sender} vous a envoyé des fichiers',
  guestPreheader: '{count} fichier reçu de {sender} | {count} fichiers reçus de {sender}',
  guestHeading: 'Fichiers reçus',
  guestIntro: '<strong>{sender}</strong>{company} a déposé {count} fichier pour vous. | <strong>{sender}</strong>{company} a déposé {count} fichiers pour vous.',
  guestFooter: 'Vous recevez cet e-mail parce que vous avez été choisi comme destinataire d\'un envoi invité.',

  magicSubject: 'Votre lien de connexion à {appName}',
  magicPreheader: 'Le lien est valable {minutes} minutes',
  magicHeading: 'Votre lien de connexion',
  magicIntro: 'Utilisez le bouton ci-dessous pour vous connecter à {appName} et envoyer des fichiers. Le lien est valable {minutes} minutes et ne peut être utilisé qu\'une seule fois.',
  magicButton: 'Se connecter et envoyer',
  magicIgnore: 'Si vous n\'avez pas demandé ce lien, vous pouvez simplement ignorer cet e-mail.',

  welcomeSubject: 'Votre accès à {appName}',
  welcomePreheader: 'Votre compte a été créé',
  welcomeHeading: 'Bienvenue sur {appName}',
  welcomeIntro: 'Bonjour {name}, un compte a été créé pour vous par {adminName}.',
  welcomeCredentials: 'E-mail : <strong>{email}</strong>\nMot de passe : <strong>{password}</strong>',
  welcomeChange: 'Veuillez changer ce mot de passe après votre première connexion.',
  welcomeButton: 'Se connecter',

  guestWelcomeSubject: 'Vous pouvez désormais envoyer des fichiers à {appName}',
  guestWelcomePreheader: 'Demandez un lien à tout moment pour envoyer des fichiers',
  guestWelcomeHeading: 'Envoyez-nous vos fichiers',
  guestWelcomeIntro: 'Bonjour {name}, vous pouvez désormais nous envoyer des fichiers en toute sécurité. Aucun mot de passe n\'est nécessaire : saisissez votre adresse e-mail sur la page ci-dessous et vous recevrez un lien de connexion à usage unique.',
  guestWelcomeButton: 'Envoyer des fichiers',

  resetSubject: 'Réinitialiser votre mot de passe',
  resetPreheader: 'Le lien est valable 24 heures',
  resetHeading: 'Réinitialiser votre mot de passe',
  resetIntro: 'Une réinitialisation du mot de passe a été demandée pour votre compte {appName}. Le lien est valable 24 heures.',
  resetButton: 'Choisir un nouveau mot de passe',
  resetIgnore: 'Si vous n\'êtes pas à l\'origine de cette demande, vous pouvez ignorer cet e-mail : votre mot de passe reste inchangé.',

  messageFrom: 'Message de {sender} :',
  totalSize: '{count} fichier · {size} | {count} fichiers · {size}'
}

const es: typeof en = {
  transferSubject: '{sender} le ha enviado archivos',
  transferSubjectNamed: '{sender} le ha enviado archivos: {subject}',
  transferPreheader: '{count} archivo, disponible hasta el {expiry} | {count} archivos, disponibles hasta el {expiry}',
  transferPreheaderUnlimited: '{count} archivo, sin fecha de caducidad | {count} archivos, sin fecha de caducidad',
  transferHeading: 'Ha recibido archivos',
  transferIntro: '<strong>{sender}</strong> le ha enviado {count} archivo a través de {appName}. | <strong>{sender}</strong> le ha enviado {count} archivos a través de {appName}.',
  transferButton: 'Descargar archivos',
  transferExpiry: 'Estos archivos están disponibles hasta el <strong>{expiry}</strong>. Después se eliminan definitivamente del servidor.',
  transferExpiryUnlimited: 'Estos archivos no tienen fecha de caducidad.',
  transferFooter: 'Recibe este correo porque {sender} le ha enviado archivos a través de {appName}.',

  receiptSubject: 'Su transferencia ha sido enviada',
  receiptPreheader: 'Enviada a {recipients}',
  receiptHeading: 'Su transferencia está en camino',
  receiptIntro: 'Su archivo se ha enviado a <strong>{recipients}</strong>. | Sus {count} archivos se han enviado a <strong>{recipients}</strong>.',
  receiptButton: 'Ver transferencia',
  receiptFooter: 'Recibe este correo porque usted creó la transferencia.',

  expiryWarningSubject: 'Su transferencia caduca pronto',
  expiryWarningSubjectNamed: 'Su transferencia caduca pronto: {subject}',
  expiryWarningPreheader: 'Caduca el {expiry}; después, los archivos desaparecen',
  expiryWarningHeading: 'Esta transferencia está a punto de caducar',
  expiryWarningIntro: 'El archivo que envió el {sent} dejará de estar disponible en breve. | Los {count} archivos que envió el {sent} dejarán de estar disponibles en breve.',
  expiryWarningRecipients: 'Enviada a <strong>{recipients}</strong>.',
  expiryWarningLinkOnly: 'Es una transferencia solo por enlace, así que nadie fue avisado por correo: solo puede acceder quien haya recibido el enlace de usted.',
  expiryWarningNotDownloaded: 'Todavía no se ha descargado.',
  expiryWarningDownloaded: 'Se ha descargado {count} vez. | Se ha descargado {count} veces.',
  expiryWarningDeadline: 'El <strong>{expiry}</strong> el enlace dejará de funcionar y los archivos se eliminarán definitivamente del servidor. Esto no se puede deshacer.',
  expiryWarningAction: 'Si aún los necesita, descárguelos ahora o envíelos de nuevo.',
  expiryWarningButton: 'Abrir transferencia',
  expiryWarningFooter: 'Recibe este correo porque usted creó la transferencia. Se envía una sola vez, poco antes de que se eliminen los archivos.',

  guestSubject: '{sender} le ha enviado archivos',
  guestPreheader: '{count} archivo recibido de {sender} | {count} archivos recibidos de {sender}',
  guestHeading: 'Archivos recibidos',
  guestIntro: '<strong>{sender}</strong>{company} ha subido {count} archivo para usted. | <strong>{sender}</strong>{company} ha subido {count} archivos para usted.',
  guestFooter: 'Recibe este correo porque fue elegido como destinatario de una subida de invitado.',

  magicSubject: 'Su enlace de acceso a {appName}',
  magicPreheader: 'El enlace es válido durante {minutes} minutos',
  magicHeading: 'Su enlace de acceso',
  magicIntro: 'Use el botón de abajo para iniciar sesión en {appName} y subir archivos. El enlace es válido durante {minutes} minutos y solo puede usarse una vez.',
  magicButton: 'Iniciar sesión y subir',
  magicIgnore: 'Si no ha solicitado este enlace, puede simplemente ignorar este correo.',

  welcomeSubject: 'Su acceso a {appName}',
  welcomePreheader: 'Su cuenta ha sido creada',
  welcomeHeading: 'Bienvenido a {appName}',
  welcomeIntro: 'Hola {name}, {adminName} ha creado una cuenta para usted.',
  welcomeCredentials: 'Correo electrónico: <strong>{email}</strong>\nContraseña: <strong>{password}</strong>',
  welcomeChange: 'Cambie esta contraseña después de su primer inicio de sesión.',
  welcomeButton: 'Iniciar sesión',

  guestWelcomeSubject: 'Ya puede enviar archivos a {appName}',
  guestWelcomePreheader: 'Solicite un enlace en cualquier momento para subir archivos',
  guestWelcomeHeading: 'Envíenos sus archivos',
  guestWelcomeIntro: 'Hola {name}, ya puede enviarnos archivos de forma segura. No necesita contraseña: introduzca su dirección de correo en la página de abajo y recibirá un enlace de acceso de un solo uso.',
  guestWelcomeButton: 'Enviar archivos',

  resetSubject: 'Restablecer su contraseña',
  resetPreheader: 'El enlace es válido durante 24 horas',
  resetHeading: 'Restablecer su contraseña',
  resetIntro: 'Se ha solicitado un restablecimiento de contraseña para su cuenta de {appName}. El enlace es válido durante 24 horas.',
  resetButton: 'Elegir una nueva contraseña',
  resetIgnore: 'Si no lo ha solicitado, puede ignorar este correo: su contraseña no cambia.',

  messageFrom: 'Mensaje de {sender}:',
  totalSize: '{count} archivo · {size} | {count} archivos · {size}'
}

const it: typeof en = {
  transferSubject: '{sender} le ha inviato dei file',
  transferSubjectNamed: '{sender} le ha inviato dei file: {subject}',
  transferPreheader: '{count} file, disponibile fino al {expiry} | {count} file, disponibili fino al {expiry}',
  transferPreheaderUnlimited: '{count} file, senza scadenza | {count} file, senza scadenza',
  transferHeading: 'Ha ricevuto dei file',
  transferIntro: '<strong>{sender}</strong> le ha inviato {count} file tramite {appName}. | <strong>{sender}</strong> le ha inviato {count} file tramite {appName}.',
  transferButton: 'Scarica i file',
  transferExpiry: 'Questi file sono disponibili fino al <strong>{expiry}</strong>. Dopo di che vengono eliminati definitivamente dal server.',
  transferExpiryUnlimited: 'Questi file non hanno una data di scadenza.',
  transferFooter: 'Riceve questa e-mail perché {sender} le ha inviato dei file tramite {appName}.',

  receiptSubject: 'Il suo trasferimento è stato inviato',
  receiptPreheader: 'Inviato a {recipients}',
  receiptHeading: 'Il suo trasferimento è in viaggio',
  receiptIntro: 'Il suo file è stato inviato a <strong>{recipients}</strong>. | I suoi {count} file sono stati inviati a <strong>{recipients}</strong>.',
  receiptButton: 'Vedi trasferimento',
  receiptFooter: 'Riceve questa e-mail perché ha creato il trasferimento.',

  expiryWarningSubject: 'Il suo trasferimento scade a breve',
  expiryWarningSubjectNamed: 'Il suo trasferimento scade a breve: {subject}',
  expiryWarningPreheader: 'Scade il {expiry} — dopo, i file non ci sono più',
  expiryWarningHeading: 'Questo trasferimento sta per scadere',
  expiryWarningIntro: 'Il file che ha inviato il {sent} tra poco non sarà più disponibile. | I {count} file che ha inviato il {sent} tra poco non saranno più disponibili.',
  expiryWarningRecipients: 'Inviato a <strong>{recipients}</strong>.',
  expiryWarningLinkOnly: 'È un trasferimento solo tramite link: nessuno è stato avvisato via e-mail, e può accedervi solo chi ha ricevuto il link da lei.',
  expiryWarningNotDownloaded: 'Non è ancora stato scaricato.',
  expiryWarningDownloaded: 'È stato scaricato {count} volta. | È stato scaricato {count} volte.',
  expiryWarningDeadline: 'Il <strong>{expiry}</strong> il link smetterà di funzionare e i file verranno eliminati definitivamente dal server. L\'operazione non può essere annullata.',
  expiryWarningAction: 'Se le servono ancora, li scarichi adesso o li invii di nuovo.',
  expiryWarningButton: 'Apri trasferimento',
  expiryWarningFooter: 'Riceve questa e-mail perché ha creato il trasferimento. Viene inviata una sola volta, poco prima dell\'eliminazione dei file.',

  guestSubject: '{sender} le ha inviato dei file',
  guestPreheader: '{count} file ricevuto da {sender} | {count} file ricevuti da {sender}',
  guestHeading: 'File ricevuti',
  guestIntro: '<strong>{sender}</strong>{company} ha caricato {count} file per lei. | <strong>{sender}</strong>{company} ha caricato {count} file per lei.',
  guestFooter: 'Riceve questa e-mail perché è stato scelto come destinatario di un caricamento ospite.',

  magicSubject: 'Il suo link di accesso a {appName}',
  magicPreheader: 'Il link è valido per {minutes} minuti',
  magicHeading: 'Il suo link di accesso',
  magicIntro: 'Usi il pulsante qui sotto per accedere a {appName} e caricare file. Il link è valido per {minutes} minuti e può essere usato una sola volta.',
  magicButton: 'Accedi e carica',
  magicIgnore: 'Se non ha richiesto questo link, può semplicemente ignorare questa e-mail.',

  welcomeSubject: 'Il suo accesso a {appName}',
  welcomePreheader: 'Il suo account è stato creato',
  welcomeHeading: 'Benvenuto su {appName}',
  welcomeIntro: 'Salve {name}, {adminName} ha creato un account per lei.',
  welcomeCredentials: 'E-mail: <strong>{email}</strong>\nPassword: <strong>{password}</strong>',
  welcomeChange: 'Cambi questa password dopo il primo accesso.',
  welcomeButton: 'Accedi',

  guestWelcomeSubject: 'Ora può inviare file a {appName}',
  guestWelcomePreheader: 'Richieda un link in qualsiasi momento per caricare file',
  guestWelcomeHeading: 'Ci invii i suoi file',
  guestWelcomeIntro: 'Salve {name}, ora può inviarci file in modo sicuro. Non serve una password: inserisca il suo indirizzo e-mail nella pagina qui sotto e riceverà un link di accesso monouso.',
  guestWelcomeButton: 'Invia file',

  resetSubject: 'Reimposta la password',
  resetPreheader: 'Il link è valido per 24 ore',
  resetHeading: 'Reimposta la password',
  resetIntro: 'È stata richiesta la reimpostazione della password per il suo account {appName}. Il link è valido per 24 ore.',
  resetButton: 'Scegli una nuova password',
  resetIgnore: 'Se non è stato lei a richiederla, può ignorare questa e-mail: la sua password resta invariata.',

  messageFrom: 'Messaggio da {sender}:',
  totalSize: '{count} file · {size} | {count} file · {size}'
}

const nl: typeof en = {
  transferSubject: '{sender} heeft u bestanden gestuurd',
  transferSubjectNamed: '{sender} heeft u bestanden gestuurd: {subject}',
  transferPreheader: '{count} bestand, beschikbaar tot {expiry} | {count} bestanden, beschikbaar tot {expiry}',
  transferPreheaderUnlimited: '{count} bestand, zonder vervaldatum | {count} bestanden, zonder vervaldatum',
  transferHeading: 'U hebt bestanden ontvangen',
  transferIntro: '<strong>{sender}</strong> heeft u {count} bestand gestuurd via {appName}. | <strong>{sender}</strong> heeft u {count} bestanden gestuurd via {appName}.',
  transferButton: 'Bestanden downloaden',
  transferExpiry: 'Deze bestanden zijn beschikbaar tot <strong>{expiry}</strong>. Daarna worden ze definitief van de server verwijderd.',
  transferExpiryUnlimited: 'Deze bestanden hebben geen vervaldatum.',
  transferFooter: 'U ontvangt deze e-mail omdat {sender} u bestanden heeft gestuurd via {appName}.',

  receiptSubject: 'Uw overdracht is verstuurd',
  receiptPreheader: 'Verstuurd naar {recipients}',
  receiptHeading: 'Uw overdracht is onderweg',
  receiptIntro: 'Uw bestand is verstuurd naar <strong>{recipients}</strong>. | Uw {count} bestanden zijn verstuurd naar <strong>{recipients}</strong>.',
  receiptButton: 'Overdracht bekijken',
  receiptFooter: 'U ontvangt deze e-mail omdat u de overdracht hebt aangemaakt.',

  expiryWarningSubject: 'Uw overdracht verloopt binnenkort',
  expiryWarningSubjectNamed: 'Uw overdracht verloopt binnenkort: {subject}',
  expiryWarningPreheader: 'Verloopt op {expiry} — daarna zijn de bestanden weg',
  expiryWarningHeading: 'Deze overdracht verloopt binnenkort',
  expiryWarningIntro: 'Het bestand dat u op {sent} hebt verstuurd is binnenkort niet meer beschikbaar. | De {count} bestanden die u op {sent} hebt verstuurd zijn binnenkort niet meer beschikbaar.',
  expiryWarningRecipients: 'Verstuurd naar <strong>{recipients}</strong>.',
  expiryWarningLinkOnly: 'Dit is een overdracht met alleen een link, dus niemand is per e-mail op de hoogte gebracht — alleen wie de link van u heeft gekregen, kan erbij.',
  expiryWarningNotDownloaded: 'Het is nog niet gedownload.',
  expiryWarningDownloaded: 'Het is {count} keer gedownload. | Het is {count} keer gedownload.',
  expiryWarningDeadline: 'Op <strong>{expiry}</strong> stopt de link met werken en worden de bestanden definitief van de server verwijderd. Dit kan niet ongedaan worden gemaakt.',
  expiryWarningAction: 'Hebt u ze nog nodig, download ze dan nu of verstuur ze opnieuw.',
  expiryWarningButton: 'Overdracht openen',
  expiryWarningFooter: 'U ontvangt deze e-mail omdat u de overdracht hebt aangemaakt. Hij wordt eenmalig verstuurd, kort voordat de bestanden worden verwijderd.',

  guestSubject: '{sender} heeft u bestanden gestuurd',
  guestPreheader: '{count} bestand ontvangen van {sender} | {count} bestanden ontvangen van {sender}',
  guestHeading: 'Bestanden ontvangen',
  guestIntro: '<strong>{sender}</strong>{company} heeft {count} bestand voor u geüpload. | <strong>{sender}</strong>{company} heeft {count} bestanden voor u geüpload.',
  guestFooter: 'U ontvangt deze e-mail omdat u bent gekozen als ontvanger van een gastupload.',

  magicSubject: 'Uw inloglink voor {appName}',
  magicPreheader: 'De link is {minutes} minuten geldig',
  magicHeading: 'Uw inloglink',
  magicIntro: 'Gebruik de knop hieronder om in te loggen bij {appName} en bestanden te uploaden. De link is {minutes} minuten geldig en kan maar één keer worden gebruikt.',
  magicButton: 'Inloggen en uploaden',
  magicIgnore: 'Als u deze link niet hebt aangevraagd, kunt u deze e-mail gewoon negeren.',

  welcomeSubject: 'Uw toegang tot {appName}',
  welcomePreheader: 'Uw account is aangemaakt',
  welcomeHeading: 'Welkom bij {appName}',
  welcomeIntro: 'Hallo {name}, {adminName} heeft een account voor u aangemaakt.',
  welcomeCredentials: 'E-mail: <strong>{email}</strong>\nWachtwoord: <strong>{password}</strong>',
  welcomeChange: 'Wijzig dit wachtwoord na uw eerste keer inloggen.',
  welcomeButton: 'Inloggen',

  guestWelcomeSubject: 'U kunt nu bestanden versturen naar {appName}',
  guestWelcomePreheader: 'Vraag op elk moment een link aan om bestanden te uploaden',
  guestWelcomeHeading: 'Stuur ons uw bestanden',
  guestWelcomeIntro: 'Hallo {name}, u kunt ons nu veilig bestanden sturen. U hebt geen wachtwoord nodig: vul uw e-mailadres in op de pagina hieronder en u ontvangt een eenmalige inloglink.',
  guestWelcomeButton: 'Bestanden versturen',

  resetSubject: 'Wachtwoord opnieuw instellen',
  resetPreheader: 'De link is 24 uur geldig',
  resetHeading: 'Wachtwoord opnieuw instellen',
  resetIntro: 'Er is een wachtwoordherstel aangevraagd voor uw {appName}-account. De link is 24 uur geldig.',
  resetButton: 'Nieuw wachtwoord kiezen',
  resetIgnore: 'Als u dit niet hebt aangevraagd, kunt u deze e-mail negeren — uw wachtwoord blijft ongewijzigd.',

  messageFrom: 'Bericht van {sender}:',
  totalSize: '{count} bestand · {size} | {count} bestanden · {size}'
}

// Polish, Ukrainian and Czech count in three forms: one / few / many. Every
// string with a count carries all three, and pluralIndex() picks among them.
const pl: typeof en = {
  transferSubject: '{sender} przesyła Ci pliki',
  transferSubjectNamed: '{sender} przesyła Ci pliki: {subject}',
  transferPreheader: '{count} plik, dostępny do {expiry} | {count} pliki, dostępne do {expiry} | {count} plików, dostępnych do {expiry}',
  transferPreheaderUnlimited: '{count} plik, bez terminu wygaśnięcia | {count} pliki, bez terminu wygaśnięcia | {count} plików, bez terminu wygaśnięcia',
  transferHeading: 'Otrzymano pliki',
  transferIntro: '<strong>{sender}</strong> przesyła Ci {count} plik przez {appName}. | <strong>{sender}</strong> przesyła Ci {count} pliki przez {appName}. | <strong>{sender}</strong> przesyła Ci {count} plików przez {appName}.',
  transferButton: 'Pobierz pliki',
  transferExpiry: 'Pliki są dostępne do <strong>{expiry}</strong>. Po tym czasie zostaną bezpowrotnie usunięte z serwera.',
  transferExpiryUnlimited: 'Te pliki nie mają terminu wygaśnięcia.',
  transferFooter: 'Otrzymujesz tę wiadomość, ponieważ {sender} przesyła Ci pliki przez {appName}.',

  receiptSubject: 'Transfer został wysłany',
  receiptPreheader: 'Wysłano do {recipients}',
  receiptHeading: 'Transfer jest w drodze',
  receiptIntro: 'Plik został wysłany do <strong>{recipients}</strong>. | {count} pliki zostały wysłane do <strong>{recipients}</strong>. | {count} plików zostało wysłanych do <strong>{recipients}</strong>.',
  receiptButton: 'Zobacz transfer',
  receiptFooter: 'Otrzymujesz tę wiadomość, ponieważ utworzono ten transfer z Twojego konta.',

  expiryWarningSubject: 'Transfer wkrótce wygaśnie',
  expiryWarningSubjectNamed: 'Transfer wkrótce wygaśnie: {subject}',
  expiryWarningPreheader: 'Wygasa {expiry} — po tym czasie pliki znikną',
  expiryWarningHeading: 'Ten transfer wkrótce wygaśnie',
  expiryWarningIntro: 'Plik wysłany {sent} wkrótce przestanie być dostępny. | {count} pliki wysłane {sent} wkrótce przestaną być dostępne. | {count} plików wysłanych {sent} wkrótce przestanie być dostępnych.',
  expiryWarningRecipients: 'Wysłano do <strong>{recipients}</strong>.',
  expiryWarningLinkOnly: 'To transfer udostępniony tylko linkiem — nikt nie został powiadomiony e-mailem. Dostęp ma tylko ten, komu przekazano link.',
  expiryWarningNotDownloaded: 'Nie został jeszcze pobrany.',
  expiryWarningDownloaded: 'Został pobrany {count} raz. | Został pobrany {count} razy. | Został pobrany {count} razy.',
  expiryWarningDeadline: '<strong>{expiry}</strong> link przestanie działać, a pliki zostaną bezpowrotnie usunięte z serwera. Tej operacji nie można cofnąć.',
  expiryWarningAction: 'Jeśli pliki są nadal potrzebne, pobierz je teraz lub wyślij ponownie.',
  expiryWarningButton: 'Otwórz transfer',
  expiryWarningFooter: 'Otrzymujesz tę wiadomość, ponieważ utworzono ten transfer z Twojego konta. Jest wysyłana jednorazowo, krótko przed usunięciem plików.',

  guestSubject: '{sender} przesyła Ci pliki',
  guestPreheader: 'Otrzymano {count} plik od {sender} | Otrzymano {count} pliki od {sender} | Otrzymano {count} plików od {sender}',
  guestHeading: 'Otrzymano pliki',
  guestIntro: '<strong>{sender}</strong>{company} przesyła Ci {count} plik. | <strong>{sender}</strong>{company} przesyła Ci {count} pliki. | <strong>{sender}</strong>{company} przesyła Ci {count} plików.',
  guestFooter: 'Otrzymujesz tę wiadomość, ponieważ wybrano Cię jako odbiorcę plików przesłanych przez gościa.',

  magicSubject: 'Twój link do logowania w {appName}',
  magicPreheader: 'Link jest ważny przez {minutes} minut',
  magicHeading: 'Twój link do logowania',
  magicIntro: 'Użyj przycisku poniżej, aby zalogować się w {appName} i przesłać pliki. Link jest ważny przez {minutes} minut i można go użyć tylko raz.',
  magicButton: 'Zaloguj się i prześlij',
  magicIgnore: 'Jeśli nie prosiłeś o ten link, po prostu zignoruj tę wiadomość.',

  welcomeSubject: 'Twój dostęp do {appName}',
  welcomePreheader: 'Twoje konto zostało utworzone',
  welcomeHeading: 'Witamy w {appName}',
  welcomeIntro: 'Cześć {name}, {adminName} utworzył(a) dla Ciebie konto.',
  welcomeCredentials: 'E-mail: <strong>{email}</strong>\nHasło: <strong>{password}</strong>',
  welcomeChange: 'Zmień to hasło po pierwszym zalogowaniu.',
  welcomeButton: 'Zaloguj się',

  guestWelcomeSubject: 'Możesz teraz przesyłać pliki do {appName}',
  guestWelcomePreheader: 'W każdej chwili poproś o link, aby przesłać pliki',
  guestWelcomeHeading: 'Prześlij nam swoje pliki',
  guestWelcomeIntro: 'Cześć {name}, możesz teraz bezpiecznie przesyłać nam pliki. Nie potrzebujesz hasła: wpisz swój adres e-mail na poniższej stronie, a otrzymasz jednorazowy link do logowania.',
  guestWelcomeButton: 'Wyślij pliki',

  resetSubject: 'Zresetuj hasło',
  resetPreheader: 'Link jest ważny przez 24 godziny',
  resetHeading: 'Zresetuj hasło',
  resetIntro: 'Dla Twojego konta w {appName} poproszono o zresetowanie hasła. Link jest ważny przez 24 godziny.',
  resetButton: 'Ustaw nowe hasło',
  resetIgnore: 'Jeśli to nie Ty, zignoruj tę wiadomość — Twoje hasło pozostaje bez zmian.',

  messageFrom: 'Wiadomość od {sender}:',
  totalSize: '{count} plik · {size} | {count} pliki · {size} | {count} plików · {size}'
}

const uk: typeof en = {
  transferSubject: '{sender} надсилає вам файли',
  transferSubjectNamed: '{sender} надсилає вам файли: {subject}',
  transferPreheader: '{count} файл, доступний до {expiry} | {count} файли, доступні до {expiry} | {count} файлів, доступних до {expiry}',
  transferPreheaderUnlimited: '{count} файл, без терміну дії | {count} файли, без терміну дії | {count} файлів, без терміну дії',
  transferHeading: 'Ви отримали файли',
  transferIntro: '<strong>{sender}</strong> надсилає вам {count} файл через {appName}. | <strong>{sender}</strong> надсилає вам {count} файли через {appName}. | <strong>{sender}</strong> надсилає вам {count} файлів через {appName}.',
  transferButton: 'Завантажити файли',
  transferExpiry: 'Ці файли доступні до <strong>{expiry}</strong>. Після цього їх буде назавжди видалено з сервера.',
  transferExpiryUnlimited: 'Ці файли не мають терміну дії.',
  transferFooter: 'Ви отримали цього листа, тому що {sender} надіслав(ла) вам файли через {appName}.',

  receiptSubject: 'Вашу передачу надіслано',
  receiptPreheader: 'Надіслано: {recipients}',
  receiptHeading: 'Ваша передача в дорозі',
  receiptIntro: 'Ваш файл надіслано: <strong>{recipients}</strong>. | Ваші {count} файли надіслано: <strong>{recipients}</strong>. | Ваші {count} файлів надіслано: <strong>{recipients}</strong>.',
  receiptButton: 'Переглянути передачу',
  receiptFooter: 'Ви отримали цього листа, тому що створили цю передачу.',

  expiryWarningSubject: 'Термін дії вашої передачі скоро мине',
  expiryWarningSubjectNamed: 'Термін дії вашої передачі скоро мине: {subject}',
  expiryWarningPreheader: 'Діє до {expiry} — після цього файли зникнуть',
  expiryWarningHeading: 'Термін дії цієї передачі скоро мине',
  expiryWarningIntro: 'Файл, який ви надіслали {sent}, незабаром стане недоступним. | {count} файли, які ви надіслали {sent}, незабаром стануть недоступними. | {count} файлів, які ви надіслали {sent}, незабаром стануть недоступними.',
  expiryWarningRecipients: 'Надіслано: <strong>{recipients}</strong>.',
  expiryWarningLinkOnly: 'Це передача лише за посиланням, тож нікого не сповіщено електронною поштою — доступ має лише той, кому ви дали посилання.',
  expiryWarningNotDownloaded: 'Її ще не завантажували.',
  expiryWarningDownloaded: 'Її завантажили {count} раз. | Її завантажили {count} рази. | Її завантажили {count} разів.',
  expiryWarningDeadline: '<strong>{expiry}</strong> посилання перестане працювати, а файли буде назавжди видалено з сервера. Цю дію не можна скасувати.',
  expiryWarningAction: 'Якщо файли ще потрібні, завантажте їх зараз або надішліть знову.',
  expiryWarningButton: 'Відкрити передачу',
  expiryWarningFooter: 'Ви отримали цього листа, тому що створили цю передачу. Він надсилається один раз, незадовго до видалення файлів.',

  guestSubject: '{sender} надсилає вам файли',
  guestPreheader: 'Отримано {count} файл від {sender} | Отримано {count} файли від {sender} | Отримано {count} файлів від {sender}',
  guestHeading: 'Файли отримано',
  guestIntro: '<strong>{sender}</strong>{company} завантажив(ла) для вас {count} файл. | <strong>{sender}</strong>{company} завантажив(ла) для вас {count} файли. | <strong>{sender}</strong>{company} завантажив(ла) для вас {count} файлів.',
  guestFooter: 'Ви отримали цього листа, тому що вас обрано одержувачем гостьового завантаження.',

  magicSubject: 'Ваше посилання для входу в {appName}',
  magicPreheader: 'Посилання дійсне {minutes} хвилин',
  magicHeading: 'Ваше посилання для входу',
  magicIntro: 'Натисніть кнопку нижче, щоб увійти в {appName} і завантажити файли. Посилання дійсне {minutes} хвилин, і скористатися ним можна лише один раз.',
  magicButton: 'Увійти та завантажити',
  magicIgnore: 'Якщо ви не запитували це посилання, просто проігноруйте цього листа.',

  welcomeSubject: 'Ваш доступ до {appName}',
  welcomePreheader: 'Ваш обліковий запис створено',
  welcomeHeading: 'Ласкаво просимо до {appName}',
  welcomeIntro: 'Вітаємо, {name}! {adminName} створив(ла) для вас обліковий запис.',
  welcomeCredentials: 'Електронна пошта: <strong>{email}</strong>\nПароль: <strong>{password}</strong>',
  welcomeChange: 'Будь ласка, змініть цей пароль після першого входу.',
  welcomeButton: 'Увійти',

  guestWelcomeSubject: 'Тепер ви можете надсилати файли до {appName}',
  guestWelcomePreheader: 'Запитуйте посилання будь-коли, щоб завантажити файли',
  guestWelcomeHeading: 'Надішліть нам свої файли',
  guestWelcomeIntro: 'Вітаємо, {name}! Тепер ви можете безпечно надсилати нам файли. Пароль не потрібен: введіть свою адресу електронної пошти на сторінці нижче, і ви отримаєте одноразове посилання для входу.',
  guestWelcomeButton: 'Надіслати файли',

  resetSubject: 'Скидання пароля',
  resetPreheader: 'Посилання дійсне 24 години',
  resetHeading: 'Скидання пароля',
  resetIntro: 'Для вашого облікового запису в {appName} запитано скидання пароля. Посилання дійсне 24 години.',
  resetButton: 'Вибрати новий пароль',
  resetIgnore: 'Якщо ви цього не запитували, проігноруйте цього листа — ваш пароль залишиться без змін.',

  messageFrom: 'Повідомлення від {sender}:',
  totalSize: '{count} файл · {size} | {count} файли · {size} | {count} файлів · {size}'
}

const pt: typeof en = {
  transferSubject: '{sender} enviou-lhe ficheiros',
  transferSubjectNamed: '{sender} enviou-lhe ficheiros: {subject}',
  transferPreheader: '{count} ficheiro, disponível até {expiry} | {count} ficheiros, disponíveis até {expiry}',
  transferPreheaderUnlimited: '{count} ficheiro, sem data de expiração | {count} ficheiros, sem data de expiração',
  transferHeading: 'Recebeu ficheiros',
  transferIntro: '<strong>{sender}</strong> enviou-lhe {count} ficheiro através do {appName}. | <strong>{sender}</strong> enviou-lhe {count} ficheiros através do {appName}.',
  transferButton: 'Descarregar ficheiros',
  transferExpiry: 'Estes ficheiros estão disponíveis até <strong>{expiry}</strong>. Depois disso, são eliminados definitivamente do servidor.',
  transferExpiryUnlimited: 'Estes ficheiros não têm data de expiração.',
  transferFooter: 'Recebeu este e-mail porque {sender} lhe enviou ficheiros através do {appName}.',

  receiptSubject: 'A sua transferência foi enviada',
  receiptPreheader: 'Enviada para {recipients}',
  receiptHeading: 'A sua transferência está a caminho',
  receiptIntro: 'O seu ficheiro foi enviado para <strong>{recipients}</strong>. | Os seus {count} ficheiros foram enviados para <strong>{recipients}</strong>.',
  receiptButton: 'Ver transferência',
  receiptFooter: 'Recebe este e-mail porque criou a transferência.',

  expiryWarningSubject: 'A sua transferência expira em breve',
  expiryWarningSubjectNamed: 'A sua transferência expira em breve: {subject}',
  expiryWarningPreheader: 'Expira a {expiry} — depois disso, os ficheiros desaparecem',
  expiryWarningHeading: 'Esta transferência está prestes a expirar',
  expiryWarningIntro: 'O ficheiro que enviou a {sent} deixará de estar disponível em breve. | Os {count} ficheiros que enviou a {sent} deixarão de estar disponíveis em breve.',
  expiryWarningRecipients: 'Enviada para <strong>{recipients}</strong>.',
  expiryWarningLinkOnly: 'Esta é uma transferência apenas por ligação, por isso ninguém foi avisado por e-mail — só quem recebeu a ligação de si lhe pode aceder.',
  expiryWarningNotDownloaded: 'Ainda não foi descarregado.',
  expiryWarningDownloaded: 'Foi descarregado {count} vez. | Foi descarregado {count} vezes.',
  expiryWarningDeadline: 'A <strong>{expiry}</strong> a ligação deixa de funcionar e os ficheiros são eliminados definitivamente do servidor. Isto não pode ser anulado.',
  expiryWarningAction: 'Se ainda precisar deles, descarregue-os agora ou envie-os de novo.',
  expiryWarningButton: 'Abrir transferência',
  expiryWarningFooter: 'Recebe este e-mail porque criou a transferência. É enviado uma única vez, pouco antes de os ficheiros serem eliminados.',

  guestSubject: '{sender} enviou-lhe ficheiros',
  guestPreheader: '{count} ficheiro recebido de {sender} | {count} ficheiros recebidos de {sender}',
  guestHeading: 'Ficheiros recebidos',
  guestIntro: '<strong>{sender}</strong>{company} carregou {count} ficheiro para si. | <strong>{sender}</strong>{company} carregou {count} ficheiros para si.',
  guestFooter: 'Recebeu este e-mail porque foi escolhido como destinatário de um carregamento de convidado.',

  magicSubject: 'A sua ligação de acesso ao {appName}',
  magicPreheader: 'A ligação é válida durante {minutes} minutos',
  magicHeading: 'A sua ligação de acesso',
  magicIntro: 'Use o botão abaixo para iniciar sessão no {appName} e carregar ficheiros. A ligação é válida durante {minutes} minutos e só pode ser usada uma vez.',
  magicButton: 'Iniciar sessão e carregar',
  magicIgnore: 'Se não pediu esta ligação, pode simplesmente ignorar este e-mail.',

  welcomeSubject: 'O seu acesso ao {appName}',
  welcomePreheader: 'A sua conta foi criada',
  welcomeHeading: 'Bem-vindo ao {appName}',
  welcomeIntro: 'Olá {name}, {adminName} criou uma conta para si.',
  welcomeCredentials: 'E-mail: <strong>{email}</strong>\nPalavra-passe: <strong>{password}</strong>',
  welcomeChange: 'Altere esta palavra-passe após o primeiro início de sessão.',
  welcomeButton: 'Iniciar sessão',

  guestWelcomeSubject: 'Já pode enviar ficheiros para o {appName}',
  guestWelcomePreheader: 'Peça uma ligação a qualquer momento para carregar ficheiros',
  guestWelcomeHeading: 'Envie-nos os seus ficheiros',
  guestWelcomeIntro: 'Olá {name}, já nos pode enviar ficheiros em segurança. Não precisa de palavra-passe: introduza o seu endereço de e-mail na página abaixo e receberá uma ligação de acesso de utilização única.',
  guestWelcomeButton: 'Enviar ficheiros',

  resetSubject: 'Repor a palavra-passe',
  resetPreheader: 'A ligação é válida durante 24 horas',
  resetHeading: 'Repor a palavra-passe',
  resetIntro: 'Foi pedida a reposição da palavra-passe da sua conta {appName}. A ligação é válida durante 24 horas.',
  resetButton: 'Escolher uma nova palavra-passe',
  resetIgnore: 'Se não fez este pedido, pode ignorar este e-mail — a sua palavra-passe mantém-se.',

  messageFrom: 'Mensagem de {sender}:',
  totalSize: '{count} ficheiro · {size} | {count} ficheiros · {size}'
}

const cs: typeof en = {
  transferSubject: '{sender} vám poslal(a) soubory',
  transferSubjectNamed: '{sender} vám poslal(a) soubory: {subject}',
  transferPreheader: '{count} soubor, dostupný do {expiry} | {count} soubory, dostupné do {expiry} | {count} souborů, dostupných do {expiry}',
  transferPreheaderUnlimited: '{count} soubor, bez data vypršení | {count} soubory, bez data vypršení | {count} souborů, bez data vypršení',
  transferHeading: 'Obdrželi jste soubory',
  transferIntro: '<strong>{sender}</strong> vám poslal(a) {count} soubor přes {appName}. | <strong>{sender}</strong> vám poslal(a) {count} soubory přes {appName}. | <strong>{sender}</strong> vám poslal(a) {count} souborů přes {appName}.',
  transferButton: 'Stáhnout soubory',
  transferExpiry: 'Tyto soubory jsou dostupné do <strong>{expiry}</strong>. Poté budou nenávratně smazány ze serveru.',
  transferExpiryUnlimited: 'Tyto soubory nemají datum vypršení.',
  transferFooter: 'Tento e-mail jste dostali, protože vám {sender} poslal(a) soubory přes {appName}.',

  receiptSubject: 'Váš přenos byl odeslán',
  receiptPreheader: 'Odesláno: {recipients}',
  receiptHeading: 'Váš přenos je na cestě',
  receiptIntro: 'Váš soubor byl odeslán: <strong>{recipients}</strong>. | Vaše {count} soubory byly odeslány: <strong>{recipients}</strong>. | Vašich {count} souborů bylo odesláno: <strong>{recipients}</strong>.',
  receiptButton: 'Zobrazit přenos',
  receiptFooter: 'Tento e-mail dostáváte, protože jste přenos vytvořili.',

  expiryWarningSubject: 'Váš přenos brzy vyprší',
  expiryWarningSubjectNamed: 'Váš přenos brzy vyprší: {subject}',
  expiryWarningPreheader: 'Vyprší {expiry} — poté budou soubory pryč',
  expiryWarningHeading: 'Tento přenos brzy vyprší',
  expiryWarningIntro: 'Soubor, který jste odeslali {sent}, brzy přestane být dostupný. | {count} soubory, které jste odeslali {sent}, brzy přestanou být dostupné. | {count} souborů, které jste odeslali {sent}, brzy přestane být dostupných.',
  expiryWarningRecipients: 'Odesláno: <strong>{recipients}</strong>.',
  expiryWarningLinkOnly: 'Jde o přenos pouze odkazem, takže nikdo nebyl upozorněn e-mailem — dostane se k němu jen ten, komu jste odkaz dali.',
  expiryWarningNotDownloaded: 'Zatím nebyl stažen.',
  expiryWarningDownloaded: 'Byl stažen {count}×. | Byl stažen {count}×. | Byl stažen {count}×.',
  expiryWarningDeadline: 'Dne <strong>{expiry}</strong> přestane odkaz fungovat a soubory budou nenávratně smazány ze serveru. Tuto akci nelze vrátit zpět.',
  expiryWarningAction: 'Pokud je ještě potřebujete, stáhněte si je nyní nebo je pošlete znovu.',
  expiryWarningButton: 'Otevřít přenos',
  expiryWarningFooter: 'Tento e-mail dostáváte, protože jste přenos vytvořili. Posílá se jednou, krátce před smazáním souborů.',

  guestSubject: '{sender} vám poslal(a) soubory',
  guestPreheader: 'Přijat {count} soubor od {sender} | Přijaty {count} soubory od {sender} | Přijato {count} souborů od {sender}',
  guestHeading: 'Soubory přijaty',
  guestIntro: '<strong>{sender}</strong>{company} pro vás nahrál(a) {count} soubor. | <strong>{sender}</strong>{company} pro vás nahrál(a) {count} soubory. | <strong>{sender}</strong>{company} pro vás nahrál(a) {count} souborů.',
  guestFooter: 'Tento e-mail jste dostali, protože jste byli zvoleni jako příjemce souborů nahraných hostem.',

  magicSubject: 'Váš přihlašovací odkaz pro {appName}',
  magicPreheader: 'Odkaz platí {minutes} minut',
  magicHeading: 'Váš přihlašovací odkaz',
  magicIntro: 'Tlačítkem níže se přihlásíte do {appName} a můžete nahrát soubory. Odkaz platí {minutes} minut a lze ho použít jen jednou.',
  magicButton: 'Přihlásit se a nahrát',
  magicIgnore: 'Pokud jste o tento odkaz nežádali, můžete tento e-mail jednoduše ignorovat.',

  welcomeSubject: 'Váš přístup do {appName}',
  welcomePreheader: 'Váš účet byl vytvořen',
  welcomeHeading: 'Vítejte v {appName}',
  welcomeIntro: 'Dobrý den, {name}, {adminName} vám vytvořil(a) účet.',
  welcomeCredentials: 'E-mail: <strong>{email}</strong>\nHeslo: <strong>{password}</strong>',
  welcomeChange: 'Po prvním přihlášení si prosím toto heslo změňte.',
  welcomeButton: 'Přihlásit se',

  guestWelcomeSubject: 'Nyní můžete posílat soubory do {appName}',
  guestWelcomePreheader: 'Kdykoli si vyžádejte odkaz pro nahrání souborů',
  guestWelcomeHeading: 'Pošlete nám své soubory',
  guestWelcomeIntro: 'Dobrý den, {name}, nyní nám můžete bezpečně posílat soubory. Heslo nepotřebujete: na stránce níže zadejte svou e-mailovou adresu a obdržíte jednorázový přihlašovací odkaz.',
  guestWelcomeButton: 'Odeslat soubory',

  resetSubject: 'Obnovení hesla',
  resetPreheader: 'Odkaz platí 24 hodin',
  resetHeading: 'Obnovení hesla',
  resetIntro: 'Pro váš účet v {appName} bylo vyžádáno obnovení hesla. Odkaz platí 24 hodin.',
  resetButton: 'Zvolit nové heslo',
  resetIgnore: 'Pokud jste o to nežádali, můžete tento e-mail ignorovat — vaše heslo zůstává beze změny.',

  messageFrom: 'Zpráva od {sender}:',
  totalSize: '{count} soubor · {size} | {count} soubory · {size} | {count} souborů · {size}'
}

const dictionaries: Record<EmailLanguage, typeof en> = { en, de, fr, es, it, nl, pl, uk, pt, cs }

export type EmailStringKey = keyof typeof en

/** Resolve the configured language, falling back to English for anything else. */
export function resolveLanguage(language: unknown): EmailLanguage {
  const code = String(language ?? '').toLowerCase().slice(0, 2)
  return isLocale(code) ? code : 'en'
}

/**
 * Look up one string and fill in its placeholders.
 *
 * A message may carry its plural forms separated by ` | `, chosen by the
 * `count` value — the same convention the client-side locale files use, and
 * the same rules: two forms are one/other, and the three Slavic languages
 * write three, one/few/many. pluralIndex() knows which is which.
 */
export function t(
  language: EmailLanguage,
  key: EmailStringKey,
  values: Record<string, string | number> = {}
): string {
  const message = dictionaries[language][key]
  const forms = message.split(' | ')

  const chosen = forms.length > 1
    ? forms[Math.min(pluralIndex(language, Number(values.count), forms.length), forms.length - 1)]!
    : forms[0]!

  return interpolate(chosen, values)
}

/**
 * Format an instant for display in mail.
 *
 * Timestamps are stored and compared in UTC, but an expiry date shown to a
 * person has to read in the timezone they actually live in — so the display zone
 * is configurable (NUXT_TIMEZONE) and independent of whatever the server's clock
 * is set to.
 */
export function formatEmailDate(
  date: Date,
  language: EmailLanguage,
  timeZone = 'UTC'
): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[language], {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone
  }).format(date)
}
