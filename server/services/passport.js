const passport = require('passport');
const PassportGoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const keys = require('../config/keys');

const User = mongoose.model('users');

passport.use(
    new PassportGoogleStrategy(
        {
            clientID:keys.googleClientID,
            clientSecret:keys.googleClientSecret,
            callbackURL:'/auth/google/callback'
        }, 
        (accessToken, refreshToken, profile, done) => {
            new User({
                googleId:profile.id
            }).save();
        }
    )
);