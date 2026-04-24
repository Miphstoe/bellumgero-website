<?php
declare(strict_types=1);

header('Content-Type: application/xml; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$serverName = 'Bellum Gero';
$host = '15.204.163.178';
$port = 44455;
$timeoutSeconds = 3.0;
$startedAt = microtime(true);
$online = false;
$playersOnline = 'Unavailable';
$uptime = 'Unavailable';
$rawResponse = '';

$socket = @fsockopen($host, $port, $errorNumber, $errorString, $timeoutSeconds);

if (is_resource($socket)) {
    $online = true;
    stream_set_timeout($socket, 1);

    while (!feof($socket)) {
        $chunk = fgets($socket, 1024);

        if ($chunk === false) {
            break;
        }

        $rawResponse .= $chunk;

        if (strlen($rawResponse) >= 8192) {
            break;
        }
    }

    fclose($socket);
}

if ($rawResponse !== '') {
    libxml_use_internal_errors(true);
    $xml = simplexml_load_string($rawResponse);

    if ($xml !== false) {
        $xmlServerName = trim((string) ($xml->serverName ?? $xml->name ?? ''));
        $xmlPlayers = trim((string) ($xml->playersOnline ?? $xml->onlinePlayers ?? $xml->players ?? ''));
        $xmlUptime = trim((string) ($xml->uptime ?? ''));

        if ($xmlServerName !== '') {
            $serverName = $xmlServerName;
        }

        if ($xmlPlayers !== '') {
            $playersOnline = $xmlPlayers;
        }

        if ($xmlUptime !== '') {
            $uptime = $xmlUptime;
        }
    }
}

$response = new DOMDocument('1.0', 'UTF-8');
$response->formatOutput = true;

$root = $response->createElement('serverStatus');
$response->appendChild($root);

$root->appendChild($response->createElement('serverName', $serverName));
$root->appendChild($response->createElement('host', $host));
$root->appendChild($response->createElement('port', (string) $port));
$root->appendChild($response->createElement('online', $online ? 'true' : 'false'));
$root->appendChild($response->createElement('playersOnline', $playersOnline));
$root->appendChild($response->createElement('uptime', $uptime));
$root->appendChild($response->createElement('responseTimeMs', (string) round((microtime(true) - $startedAt) * 1000)));
$root->appendChild($response->createElement('lastUpdated', gmdate('Y-m-d H:i:s') . ' UTC'));

echo $response->saveXML();
