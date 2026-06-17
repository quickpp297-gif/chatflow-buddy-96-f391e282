<?php
// Simple upload receiver for WhatsApp media (outgoing).
// Deploy this file alongside index.html on Hostinger (in the same folder as the
// built `dist/`). It writes uploaded files into ./uploads/{account_id}/outgoing/
// and returns { "url": "/uploads/..." }.

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Upload-Secret');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['error' => 'method_not_allowed']);
  exit;
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
  http_response_code(400);
  echo json_encode(['error' => 'no_file', 'code' => $_FILES['file']['error'] ?? null]);
  exit;
}

$file        = $_FILES['file'];
$accountId   = isset($_POST['account_id']) ? $_POST['account_id'] : '';
$clientPath  = isset($_POST['path']) ? $_POST['path'] : '';
$direction   = isset($_POST['direction']) ? $_POST['direction'] : 'outgoing';
if ($direction !== 'outgoing' && $direction !== 'incoming') {
  $direction = 'outgoing';
}

// Incoming uploads come from the server-side webhook and MUST present a shared
// secret. Outgoing uploads come from the browser and don't need one (the
// account_id + RLS on the app side already scope them).
if ($direction === 'incoming') {
  // Shared secret: must match the UPLOADS_SECRET env var set on the edge
  // function. On Hostinger, store the value in a sibling file
  // `uploads_secret.txt` (one line, no quotes). It is blocked from public
  // access by uploads/.htaccess + the FilesMatch below.
  $secretFile = __DIR__ . '/uploads_secret.txt';
  $EXPECTED_SECRET = is_readable($secretFile)
    ? trim((string) file_get_contents($secretFile))
    : (getenv('UPLOADS_SECRET') ?: '');

  if ($EXPECTED_SECRET === '') {
    http_response_code(500);
    echo json_encode(['error' => 'server_missing_secret']);
    exit;
  }

  $provided = $_SERVER['HTTP_X_UPLOAD_SECRET'] ?? '';
  // Fallbacks: some Hostinger/cPanel setups strip custom headers, so also
  // accept the secret via POST field or query string.
  if ($provided === '' && isset($_POST['secret']))  $provided = (string) $_POST['secret'];
  if ($provided === '' && isset($_GET['secret']))   $provided = (string) $_GET['secret'];
  if (!hash_equals($EXPECTED_SECRET, $provided)) {
    http_response_code(401);
    echo json_encode([
      'error'      => 'invalid_secret',
      'hint'       => 'Server expected value from uploads_secret.txt or UPLOADS_SECRET env. Check Hostinger header forwarding.',
    ]);
    exit;
  }
}

// --- Basic validation ----------------------------------------------------

// Allow only UUID-like account ids
if (!preg_match('/^[a-zA-Z0-9_-]{8,64}$/', $accountId)) {
  http_response_code(400);
  echo json_encode(['error' => 'invalid_account_id']);
  exit;
}

// Max 25 MB
if ($file['size'] > 25 * 1024 * 1024) {
  http_response_code(413);
  echo json_encode(['error' => 'file_too_large']);
  exit;
}

// Allowed MIME types (matches WhatsApp Cloud API supported media)
$allowed = [
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/3gpp',
  'audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg', 'audio/webm', 'audio/wav', 'audio/x-wav',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];

$finfo = new finfo(FILEINFO_MIME_TYPE);
$detectedMime = $finfo->file($file['tmp_name']) ?: $file['type'];
if (!in_array($detectedMime, $allowed, true)) {
  http_response_code(415);
  echo json_encode(['error' => 'unsupported_type', 'mime' => $detectedMime]);
  exit;
}

// --- Resolve target path -------------------------------------------------

$origName = $file['name'];
$safeName = preg_replace('/[^a-zA-Z0-9._-]/', '_', $origName);
if ($safeName === '' || $safeName[0] === '.') {
  $safeName = 'file_' . bin2hex(random_bytes(4));
}

$baseDir  = __DIR__ . '/uploads/' . $accountId . '/' . $direction;
if (!is_dir($baseDir)) {
  if (!mkdir($baseDir, 0775, true) && !is_dir($baseDir)) {
    http_response_code(500);
    echo json_encode(['error' => 'mkdir_failed']);
    exit;
  }
}

$finalName = time() . '_' . bin2hex(random_bytes(3)) . '_' . $safeName;
$destAbs   = $baseDir . '/' . $finalName;

if (!move_uploaded_file($file['tmp_name'], $destAbs)) {
  http_response_code(500);
  echo json_encode(['error' => 'move_failed']);
  exit;
}
@chmod($destAbs, 0644);

// --- Build public URL ----------------------------------------------------
// Script is served from /uploads.php (or /test/uploads.php etc.). We strip
// the filename so the uploads folder URL works in sub-directory installs too.

$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');
$relUrl    = $scriptDir . '/uploads/' . $accountId . '/' . $direction . '/' . $finalName;

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host   = $_SERVER['HTTP_HOST'] ?? '';
$absUrl = $scheme . '://' . $host . $relUrl;

header('Content-Type: application/json');
echo json_encode([
  'url'      => $absUrl,
  'path'     => $relUrl,
  'mime'     => $detectedMime,
  'size'     => $file['size'],
  'filename' => $finalName,
]);