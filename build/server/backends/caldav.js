// Generated by CoffeeScript 1.7.1
"use strict";
var CalDAV_CQValidator, CalendarQueryParser, CozyCalDAVBackend, Event, Exc, ICalParser, SCCS, VCalendar, VEvent, VObject_Reader, VTimezone, WebdavAccount, async, axon, time, _ref,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

Exc = require("jsDAV/lib/shared/exceptions");

SCCS = require("jsDAV/lib/CalDAV/properties/supportedCalendarComponentSet");

CalendarQueryParser = require('jsDAV/lib/CalDAV/calendarQueryParser');

VObject_Reader = require('jsDAV/lib/VObject/reader');

CalDAV_CQValidator = require('jsDAV/lib/CalDAV/calendarQueryValidator');

WebdavAccount = require('../models/webdavaccount');

Event = require('../models/event');

async = require("async");

axon = require('axon');

time = require("time");

_ref = require("cozy-ical"), ICalParser = _ref.ICalParser, VCalendar = _ref.VCalendar, VTimezone = _ref.VTimezone, VEvent = _ref.VEvent;

module.exports = CozyCalDAVBackend = (function() {
  function CozyCalDAVBackend(Event, User) {
    this.Event = Event;
    this.User = User;
    this.createCalendarObject = __bind(this.createCalendarObject, this);
    this._extractCalObject = __bind(this._extractCalObject, this);
    this.saveLastCtag = __bind(this.saveLastCtag, this);
    this.getLastCtag((function(_this) {
      return function(err, ctag) {
        var onChange, socket;
        _this.ctag = ctag + 1;
        _this.saveLastCtag(_this.ctag);
        onChange = function() {
          _this.ctag = _this.ctag + 1;
          return _this.saveLastCtag(_this.ctag);
        };
        socket = axon.socket('sub-emitter');
        socket.connect(9105);
        socket.on('alarm.*', onChange);
        return socket.on('event.*', onChange);
      };
    })(this));
  }

  CozyCalDAVBackend.prototype.getLastCtag = function(callback) {
    return WebdavAccount.first(function(err, account) {
      return callback(err, (account != null ? account.ctag : void 0) || 0);
    });
  };

  CozyCalDAVBackend.prototype.saveLastCtag = function(ctag, callback) {
    if (callback == null) {
      callback = function() {};
    }
    return WebdavAccount.first((function(_this) {
      return function(err, account) {
        if (err || !account) {
          return callback(err);
        }
        return account.updateAttributes({
          ctag: ctag
        }, function() {});
      };
    })(this));
  };

  CozyCalDAVBackend.prototype.getCalendarsForUser = function(principalUri, callback) {
    return Event.calendars((function(_this) {
      return function(err, calendars) {
        var icalCalendars;
        icalCalendars = calendars.map(function(calendar) {
          return calendar = {
            id: calendar,
            uri: calendar,
            principaluri: principalUri,
            "{http://calendarserver.org/ns/}getctag": _this.ctag,
            "{urn:ietf:params:xml:ns:caldav}supported-calendar-component-set": SCCS["new"](['VEVENT']),
            "{DAV:}displayname": calendar
          };
        });
        return callback(err, icalCalendars);
      };
    })(this));
  };

  CozyCalDAVBackend.prototype.createCalendar = function(principalUri, url, properties, callback) {
    return callback(null, null);
  };

  CozyCalDAVBackend.prototype.updateCalendar = function(calendarId, mutations, callback) {
    return callback(null, false);
  };

  CozyCalDAVBackend.prototype.deleteCalendar = function(calendarId, callback) {
    return callback(null, null);
  };

  CozyCalDAVBackend.prototype._toICal = function(obj, timezone) {
    var cal;
    cal = new VCalendar({
      organization: 'Cozy',
      title: 'Cozy Calendar'
    });
    cal.add(obj.toIcal(timezone));
    return cal.toString();
  };

  CozyCalDAVBackend.prototype.getCalendarObjects = function(calendarId, callback) {
    var objects;
    objects = [];
    return async.parallel([
      (function(_this) {
        return function(cb) {
          return _this.Event.byCalendar(calendarId, cb);
        };
      })(this), (function(_this) {
        return function(cb) {
          return _this.User.getTimezone(cb);
        };
      })(this)
    ], (function(_this) {
      return function(err, results) {
        var events, timezone;
        if (err) {
          return callback(err);
        }
        events = results[0], timezone = results[1];
        objects = events.map(function(obj) {
          var lastModification;
          if (typeof lastModification !== "undefined" && lastModification !== null) {
            lastModification = new Date(lastModification);
          } else {
            lastModification = new Date();
          }
          return {
            id: obj.id,
            uri: obj.caldavuri || ("" + obj.id + ".ics"),
            calendardata: _this._toICal(obj, timezone),
            lastmodified: lastModification.getTime()
          };
        });
        return callback(null, objects);
      };
    })(this));
  };

  CozyCalDAVBackend.prototype._findCalendarObject = function(calendarId, objectUri, callback) {
    return this.Event.byURI(objectUri, function(err, results) {
      return callback(err, results[0]);
    });
  };

  CozyCalDAVBackend.prototype._extractCalObject = function(calendarobj) {
    var found, obj, _i, _len, _ref1;
    if (calendarobj instanceof VEvent) {
      return calendarobj;
    } else {
      _ref1 = calendarobj.subComponents;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        obj = _ref1[_i];
        found = this._extractCalObject(obj);
        if (found) {
          return found;
        }
      }
      return false;
    }
  };

  CozyCalDAVBackend.prototype._parseSingleObjICal = function(calendarData, callback) {
    return new ICalParser().parseString(calendarData, (function(_this) {
      return function(err, calendar) {
        if (err) {
          return callback(err);
        }
        return callback(null, _this._extractCalObject(calendar));
      };
    })(this));
  };

  CozyCalDAVBackend.prototype.getCalendarObject = function(calendarId, objectUri, callback) {
    return this._findCalendarObject(calendarId, objectUri, (function(_this) {
      return function(err, obj) {
        if (err) {
          return callback(err);
        }
        if (!obj) {
          return callback(null, null);
        }
        return _this.User.getTimezone(function(err, timezone) {
          if (err) {
            return callback(err);
          }
          return callback(null, {
            id: obj.id,
            uri: obj.caldavuri || ("" + obj.id + ".ics"),
            calendardata: _this._toICal(obj, timezone),
            lastmodified: new Date().getTime()
          });
        });
      };
    })(this));
  };

  CozyCalDAVBackend.prototype.createCalendarObject = function(calendarId, objectUri, calendarData, callback) {
    return this._parseSingleObjICal(calendarData, (function(_this) {
      return function(err, obj) {
        var event;
        if (err) {
          return callback(err);
        }
        if (obj.name === 'VEVENT') {
          event = _this.Event.fromIcal(obj, calendarId);
          event.caldavuri = objectUri;
          return _this.Event.create(event, function(err, event) {
            return callback(err, null);
          });
        } else {
          return callback(Exc.notImplementedYet());
        }
      };
    })(this));
  };

  CozyCalDAVBackend.prototype.updateCalendarObject = function(calendarId, objectUri, calendarData, callback) {
    return this._findCalendarObject(calendarId, objectUri, (function(_this) {
      return function(err, oldObj) {
        if (err) {
          return callback(err);
        }
        return _this._parseSingleObjICal(calendarData, function(err, newObj) {
          var event;
          if (err) {
            return callback(err);
          }
          if (newObj.name === 'VEVENT' && oldObj instanceof _this.Event) {
            event = _this.Event.fromIcal(newObj, calendarId).toObject();
            delete event.id;
            return oldObj.updateAttributes(event, function(err, event) {
              return callback(err, null);
            });
          } else {
            return callback(Exc.notImplementedYet());
          }
        });
      };
    })(this));
  };

  CozyCalDAVBackend.prototype.deleteCalendarObject = function(calendarId, objectUri, callback) {
    return this._findCalendarObject(calendarId, objectUri, function(err, obj) {
      if (err) {
        return callback(err);
      }
      return obj.destroy(callback);
    });
  };

  CozyCalDAVBackend.prototype.calendarQuery = function(calendarId, filters, callback) {
    var objects, reader, validator;
    objects = [];
    reader = VObject_Reader["new"]();
    validator = CalDAV_CQValidator["new"]();
    return async.parallel([
      (function(_this) {
        return function(cb) {
          return _this.Event.byCalendar(calendarId, cb);
        };
      })(this), (function(_this) {
        return function(cb) {
          return _this.User.getTimezone(cb);
        };
      })(this)
    ], (function(_this) {
      return function(err, results) {
        var caldavuri, events, ex, ical, id, jugglingObj, lastModification, timezone, uri, vobj, _i, _len;
        if (err) {
          return callback(err);
        }
        events = results[0], timezone = results[1];
        try {
          for (_i = 0, _len = events.length; _i < _len; _i++) {
            jugglingObj = events[_i];
            ical = _this._toICal(jugglingObj, timezone);
            vobj = reader.read(ical);
            if (validator.validate(vobj, filters)) {
              id = jugglingObj.id, caldavuri = jugglingObj.caldavuri, lastModification = jugglingObj.lastModification;
              uri = caldavuri || ("" + id + ".ics");
              if (lastModification != null) {
                lastModification = new Date(lastModification);
              } else {
                lastModification = new Date();
              }
              objects.push({
                id: id,
                uri: uri,
                calendardata: ical,
                lastmodified: lastModification.getTime()
              });
            }
          }
        } catch (_error) {
          ex = _error;
          console.log(ex.stack);
          return callback(ex, []);
        }
        return callback(null, objects);
      };
    })(this));
  };

  return CozyCalDAVBackend;

})();
