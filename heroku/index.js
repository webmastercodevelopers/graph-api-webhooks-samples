/**
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
const { URLSearchParams } = require('url');
const axios = require('axios'); // For making HTTP requests
var bodyParser = require('body-parser');
var express = require('express');
var app = express();
var xhub = require('express-x-hub');

const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID || '';
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET || '';
const REDIRECT_URI = process.env.REDIRECT_URI || ''; // Replace with your domain

app.set('port', (process.env.PORT || 5000));
app.listen(app.get('port'));

app.use(xhub({ algorithm: 'sha1', secret: process.env.APP_SECRET }));
app.use(bodyParser.json());

var token = process.env.TOKEN || 'token';
var received_updates = [];

app.get('/', function (req, res) {
  console.log(req);
  res.send('<pre>' + JSON.stringify(received_updates, null, 2) + '</pre>');
});

app.get(['/facebook', '/instagram', '/threads'], function (req, res) {
  if (
    req.query['hub.mode'] == 'subscribe' &&
    req.query['hub.verify_token'] == token
  ) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

app.post('/facebook', function (req, res) {
  console.log('Facebook request body:', req.body);

  if (!req.isXHubValid()) {
    console.log('Warning - request header X-Hub-Signature not present or invalid');
    res.sendStatus(401);
    return;
  }

  console.log('request header X-Hub-Signature validated');
  // Process the Facebook updates here
  received_updates.unshift(req.body);
  res.sendStatus(200);
});

app.post('/instagram', function (req, res) {
  console.log('Instagram request body:');
  console.log(req.body);
  // Process the Instagram updates here
  received_updates.unshift(req.body);
  res.sendStatus(200);
});

app.post('/threads', function (req, res) {
  console.log('Threads request body:');
  console.log(req.body);
  // Process the Threads updates here
  received_updates.unshift(req.body);
  res.sendStatus(200);
});

// Route to handle the OAuth callback from Instagram/Meta
app.get('/auth/instagram/callback', async (req, res) => {
  try {
    // Extract the authorization code from the query params
    const code = req.query.code;

    // If there's an error (e.g., user denied permissions)
    if (req.query.error) {
      return res.status(400).send(`Error: ${req.query.error_description}`);
    }

    const params = new URLSearchParams();
    params.append('client_id', INSTAGRAM_APP_ID);
    params.append('client_secret', INSTAGRAM_APP_SECRET);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', REDIRECT_URI);
    params.append('code', code);

    const response = await axios.post(
      'https://api.instagram.com/oauth/access_token',
      params, // Send the URLSearchParams object
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const accessToken = response.data.access_token;
    const userId = response.data.user_id;

    const userProfile = await getUserProfile(accessToken);
    console.log('User Profile:', userProfile);

    // Now you have the access token! Use it to make API calls.
    // Example: Redirect to a success page or return a JSON response
    res.send(`Access Token: ${accessToken}, User ID: ${userId}`);

  } catch (error) {
    console.error('Instagram OAuth Error:', error.message);
    if (error.response) {
      // Axios response error (e.g., 4xx/5xx status code)
      console.error('Response Data:', error.response.data);
      console.error('Status Code:', error.response.status);
      res.status(500).send(`Instagram API Error: ${error.response.data.error_message}`);
    } else {
      // Network error or no response (e.g., timeout)
      res.status(500).send('Failed to connect to Instagram API');
    }
  }
});

async function getUserProfile(accessToken) {
  try {
    // Decrypt the accessToken if you stored it encrypted
    //const decryptedToken = decryptToken(accessToken, process.env.ENCRYPTION_KEY); // Assumes you have this function

    const fields = 'id,username'; // Specify fields you want
    const url = `https://graph.instagram.com/me?fields=${fields}&access_token=${accessToken}`;

    const response = await axios.get(url);
    console.log('User Profile:', response.data);
    // response.data will look like: { "id": "INSTAGRAM_USER_ID", "username": "USERNAME" }
    return response.data;
  } catch (error) {
    console.error('Error fetching Instagram profile:', error.response?.data || error.message);
    throw error;
  }
}

app.listen();
