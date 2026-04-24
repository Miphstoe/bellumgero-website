<?php
ini_set('display_errors', '1');
error_reporting(E_ALL);
header('Content-Type: text/plain; charset=UTF-8');

echo "PHP started\n";
flush();

$host = '15.204.163.178';
$port = 44455;
$timeout = 3;

echo "Trying $host:$port ...\n";
flush();

$socket = @fsockopen($host, $port, $errno, $errstr, $timeout);

if (!$socket) {
    echo "Connect failed: [$errno] $errstr\n";
    exit;
}

echo "Connected successfully\n";
fclose($socket);
