/**
 * googleIdToken.js — checks the ID token from Google's "Sign in with Google"
 * button: Google's signature, issuer, expiry, and that it was issued for our
 * client ID (audience). Returns the token's payload (sub, email,
 * email_verified, name, picture…).
 */

import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();
const checkWithGoogle = async (idToken, audience) => (await client.verifyIdToken({ idToken, audience })).getPayload();
let verify = checkWithGoogle;

/** Throws if the token isn't a valid Google ID token for `audience`. */
export const verifyGoogleIdToken = (idToken, audience) => verify(idToken, audience);

/** Tests swap in their own check so they never call Google. */
export function __setGoogleVerifierForTests(fn) {
  verify = fn ?? checkWithGoogle;
}
