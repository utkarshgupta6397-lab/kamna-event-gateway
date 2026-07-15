#!/bin/bash
set -e

echo "=================================="
echo " Kamna Event Gateway Deployment"
echo "=================================="

echo "Installing backend dependencies..."
npm install

echo "Building backend..."
npm run build

echo "Running database migrations..."
npm run db:push

echo "Installing frontend dependencies..."
cd ui

npm install

echo "Building frontend..."
npm run build

cd ..

echo "Restarting PM2..."
pm2 restart kamna-event-gateway --update-env

echo "Deployment completed successfully!"
