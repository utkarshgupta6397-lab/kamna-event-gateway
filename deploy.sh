#!/bin/bash
set -e

echo "=================================="
echo " Kamna Event Gateway Deployment"
echo "=================================="

cd /root/kamna-event-gateway

echo "Updating repository..."
git fetch origin
git checkout main
git reset --hard origin/main
git clean -fd

echo "Installing backend..."
npm install

echo "Building backend..."
npm run build

echo "Running database..."
npm run db:push

echo "Installing frontend..."
cd ui

npm install

npm run build

cd ..

echo "Restarting Gateway..."
pm2 restart kamna-event-gateway --update-env

echo ""
echo "Deployment Successful!"
