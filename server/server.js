'use strict';

var SMP = require('service-metadata-provider');
var Promise = require('bluebird');
var nconf = require('nconf');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var helmet = require('helmet');
var passport = require('passport');
var Strategy = require('passport-http').BasicStrategy;
var logger = require('morgan');

app.use(logger('dev'));
app.use(passport.initialize());
app.use(helmet());
app.disable('x-powered-by');

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

passport.use(new Strategy(
  function(userid, password, done) {
    var request = require("request");
    var options = { method: 'GET',
      url: nconf.get("userrepourl") + '/User' + userid,
      headers:
      {
        'cache-control': 'no-cache',
        authorization: 'Basic YWRtaW46TyZzJXdsVkBkOEhH'
      }
    };
    request(options, function (error, response, body) {
      if (error) { return done(error, false); }
      if(!body) { return done(null, false); }
      return done(null, body);
    });
  }
));

nconf.argv()
      .env()
      .file({ file: 'config.json' });

var amqp = require('amqplib').connect('amqp://' + nconf.get("username") + ':' + nconf.get("password") + '@' + nconf.get("mariohost"));
var marioConnection;
amqp.then(function(conn) {
    marioConnection = conn;
    console.log("Mario connection is established.");
});

var smp = new SMP(nconf.get("participantIdentifier"), nconf.get("username"), nconf.get("password"),  nconf.get("mariosbossurl"));

// REST API
app.get('/', passport.authenticate('basic', { session: false }), function (req, res) {
  res.send('Hello World. This is the CLMS CI Gateway!');
});

app.post('/publish/:participant/:concept/:action', passport.authenticate('basic', { session: false }), function (req, res) {

  console.log("got request: ", req.body);

  //(Provide, Consume, Usage)
  smp.getServiceMetadata(req.params.concept, req.params.action, "Usage", req.params.participant)
    .then(function(metadata) {
      return Promise.each(metadata, function(service, index, length){
        //console.log(service);
        var q = service.ListenQueue;
        if(q && q!=="") {
          // Consumers ==> ignore
          console.log("Ignoring service:", service);
          return;
        }

        if(service.Usage === "Consume" || (service.Usage === "Provide" && service.ServiceType === "EventService" )) {
          console.log("Publishing to " + service.SendExchange + " -> " + service.SendRoutingKey);

          marioConnection.createChannel().then(function(ch){
            ch.publish(service.SendExchange, service.SendRoutingKey, new Buffer(JSON.stringify(req.body)));
          });
        }
      });
    })
    .catch(function(err) {
      // TODO - this error is never reported to the caller!!!! due to promises
      console.error(err);
      res.status(500).send('Oops! Something broke!');
    });

    res.status(202).end();
});

app.listen(nconf.get("WWW_PORT"), function () {
  console.log('CI Gateway API listening on port ' + nconf.get("WWW_PORT"));
});
