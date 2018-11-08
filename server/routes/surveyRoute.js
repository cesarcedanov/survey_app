const _ = require('lodash');
const Path = require('path-parser').default;
const { URL } = require('url');
const mongoose = require('mongoose');
const requireLogin = require('../middlewares/requireLogin');
const requireCredits = require('../middlewares/requireCredits');
const Mailer = require('../services/Mailer');
const surveyTemplate = require('../services/emailTemplate/surveyTemplate');

const Survey = mongoose.model('surveys');

module.exports = app => {
  app.get('/api/surveys', requireLogin, async (req,res) => {
    const surveys = await Survey.find({ _user:req.user})
      .select('-recipients');
    res.send(surveys);
  });

  app.get('/api/surveys/:surveyId/:surveyResponse', (req,res) => {
    res.send('Thanks for voting');
  });
  app.post('/api/surveys', requireLogin, requireCredits, async (req, res) => {
    const { title, subject, body, recipients } = req.body;

    const survey = new Survey({
      title,
      subject,
      body,
      recipients: recipients.split(',').map(email => ({ email:email.trim() })),
      _user: req.user.id,
      dateSent: Date.now()
    });

    const mailer = new Mailer(survey,surveyTemplate(survey));
    
    try{
      await mailer.send();
      await survey.save();
      req.user.credits -= 1;
      const user = await req.user.save();

      res.send(user);
    }catch(err){
      res.status(422).send(err);
    }
  });

  app.post('/api/surveys/webhooks', (req,res) => {
    const pathParser = new Path('/api/surveys/:surveyId/:surveyResponse');

    _.chain(req.body)
      .map(({email, url}) => {
        const match = pathParser.test(new URL(url).pathname);
        if (match) {
          return {email, surveyId: match.surveyId, surveyResponse: match.surveyResponse}
        }
      })
      .compact()
      .uniqBy('email','surveyId')
      .each( ({surveyId, email,surveyResponse}) => {
        Survey.updateOne({
          _id: surveyId,
          recipients:{
            $elemMatch:{email:email,responded:false}
          }
        },{
          $inc: { [surveyResponse]:1 },
          $set: { 'recipients.$.responded':true },
          lastResponded: new Date()
        }).exec();
      })
      .value();

    res.send({});
  });

};