const request = require('request');
const config = require('../config.json');
const cheerio = require('cheerio');
const chalk = require('chalk')

module.exports = (crn, currentStatus, user, db, io, cb) => {
  if (crn.length > 10) {
    cb('CRN too long. Try not to be break my website. PLEASE.')
  } else {

    function parseHTML(result) {

      //Check for "CRN doesnt exist" error
      if (result.error) {
        cb('Sorry. According to banner, this CRN doesnt exist.')
      } else {

        const title = result.title
        if (title.length > 0) {

          //Well, that was easy
          const parsed = title.split(' - ')

          var crnInfo = {};

          //Fixes parsing Lab subjects
          if (parsed.length == 4) {
            crnInfo = {
              name: parsed[0],
              crn: parsed[1],
              className: parsed[2],
              section: parsed[3],
              subject: parsed[2].split(' ')[0],
              state: currentStatus
            }
          } else {
            crnInfo = {
              name: parsed[0] + ' ' + parsed[1],
              crn: parsed[2],
              className: parsed[3],
              section: parsed[4],
              subject: parsed[3].split(' ')[0],
              state: currentStatus
            }
          }

          //Remove extra junk that may be added
          crnInfo.section = crnInfo.section.replace(/LevelDescriptionAmount/g, '');

          //Add it to the database, or just return it if it exists
          db.crnStatus.findOrCreate({
            where: {
              crn: crnInfo.crn
            },
            defaults: {
              subject: crnInfo.subject,
              name: crnInfo.name,
              className: crnInfo.className,
              section: crnInfo.section,
              state: crnInfo.state.toLowerCase()
            }
          }).spread(function(entry, created) {

            //Add the entry to the CRN table
            db.CRN.findOrCreate({
              where: {
                crn: crnInfo.crn,
                userID: user.id
              },
              defaults: {
                crn: crnInfo.crn,
                userID: user.id
              }
            }).spread(function(data, newCRN) {
              if (newCRN) {
                cb(null, crnInfo, created)
              } else {
                cb('You already subscribed to this CRN!')
              }
            })
          })
        } else {
          console.log(chalk.red(`CRN [${crn}] had an error (Code 2, title length) DEBUG: [${title}]`))
          cb('Something went wrong with querying Banner. Wait for like 10 to 30 minutes and try again (Really, just wait. This is because of Banner, not me) or contact me. (b00073615@aus.edu) [Code: 2]')
        }
      }
    }

    //Check if CRN exists in DB
    db.crnStatus.find({
      where: {
        crn: crn
      }
    }).then(function(data) {
      if (data) {
        //Already exists in DB, just add them
        //Add the entry to the CRN table
        db.CRN.findOrCreate({
          where: {
            crn: crn,
            userID: user.id
          },
          defaults: {
            crn: crn,
            userID: user.id
          }
        }).spread(function(data2, newCRN) {
          if (newCRN) {
            cb(null, data.dataValues, false)
          } else {
            cb('You already subscribed to this CRN!')
          }
        })
      } else {
        try {
          io.emit(`checkCRN_${config.misc.secret}`, config.misc.termID, crn, function(err, body) {
            if (err) {
              console.log(chalk.red(`CRN [${crn}] had an error (Code 3, crawler error)`))
              cb('Something went wrong with querying Banner. Wait for like 10 to 30 minutes and try again or contact me. (b00073615@aus.edu) [Code: 3]')
            } else {
              parseHTML(body)
            }
          })
        } catch (e) {
          cb("Something went wrong talking to the server.", null, null)
        }
      }
    })

    // const Horseman = require('node-horseman');
    //
    // const horseman = new Horseman({
    //    cookiesFile: './cookies.txt',
    //   diskCache: true,
    //   diskCachePath: './browsercache',
    //   timeout: 15000,
    //   loadImages: false,
    //    proxyType: 'socks5',
    //    proxy: '127.0.0.1:9050',
    //   ignoreSSLErrors: true
    // });
    //
    // horseman
    //   .userAgent(random_useragent.getRandom())
    //   .on('error', function(msg){
    //     console.log(chalk.red(`Error crawling CRN!`))
    //     cb('Something went wrong with querying Banner. Wait for like 10 to 30 minutes and try again or contact me. (b00073615@aus.edu) [Code: 3]')
    //   })
    //   .on('timeout', function(){
    //     console.log(chalk.red(`Timeout crawling CRN!`))
    //     cb('Something went wrong with querying Banner. Wait for like 10 to 30 minutes and try again or contact me. (b00073615@aus.edu) [Code: 3]')
    //   })
    //   .cookies([])
    //   .open(`https://banner.aus.edu/axp3b21h/owa/bwckschd.p_disp_detail_sched?term_in=${config.misc.termID}&crn_in=${crn}`)
    //   .catch(function(e){
    //     console.log(chalk.red(`Error crawling CRN!`))
    //     cb('Something went wrong with querying Banner. Wait for like 10 to 30 minutes and try again or contact me. (b00073615@aus.edu) [Code: 3]')
    //   })
    //   .html()
    //   .then(function(body) {
    //     parseHTML(body)
    //     return horseman.close()
    // })

  }
}
