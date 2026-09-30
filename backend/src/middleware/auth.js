// Auth0 check + loading (or creating) the user record for every protected request.
import { auth } from 'express-oauth2-jwt-bearer';
import { config } from '../config.js';
import * as usersDb from '../db/users.js';
import { httpError } from '../utils/http.js';
import { todayStr } from '../utils/dates.js';

export function requireAuth() {
  if (config.authDisabled) {
    // Local testing: pretend the caller is whoever the x-dev-user header names.
    return [(req, _res, next) => {
      req.authSub = `dev|${req.header('x-dev-user') || 'local-user'}`;
      next();
    }];
  }
  return [
    auth({ audience: config.auth0.audience, issuerBaseURL: `https://${config.auth0.domain}/` }),
    (req, _res, next) => {
      req.authSub = req.auth.payload.sub; // e.g. "google-oauth2|1234..."
      next();
    },
  ];
}

// Creates the user on first login, so the frontend never needs a separate "sign up" call.
export async function loadUser(req, _res, next) {
  req.user = await usersDb.findOrCreateByAuthId(req.authSub, todayStr());
  next();
}

export function requireOnboarded(req, _res, next) {
  if (!req.user.onboarded) return next(httpError(409, 'Finish onboarding first'));
  next();
}
