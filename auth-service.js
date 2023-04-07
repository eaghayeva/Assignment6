const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');

let userSchema = new Schema({
    "userName": {
        "type": String,
        "unique": true
    },
    "password": String,
    "email": String,

    "loginHistory": [{
        "dateTime": Date,
        "userAgent": String
    }]
});

var User = mongoose.model('User', userSchema);
module.exports = User;


module.exports.initialize = function() {
    return new Promise(function(resolve, reject) {
        let db = mongoose.createConnection("mongodb+srv://agemiliya:mikayil2016@senecaweb.jeg16nu.mongodb.net/?retryWrites=true&w=majority");
        db.on('error', (err) => {


            reject(err);
        });
        db.once('open', () => {
            console.log("connected to Db mongooseee!!");
            User = db.model("users", userSchema);
            resolve();
        });
    });
};


module.exports.registerUser = function(userData) {
    return new Promise((resolve, reject) => {
        if (userData.password !== userData.password2)
            reject("Passwords do not match");

        bcrypt.hash(userData.password, 10).then(hash => {

            /** create newUser (username) and save it */
            userData.password = hash;
            let newUser = new User(userData);



            newUser.save()
                .then(result => {
                    // Handle success
                    resolve();
                })
                .catch(err => {
                    // Handle error
                    if (err && err.code === 11000)
                        reject("User Name already taken");
                    else if (err && err.code !== 11000)
                        reject("There was an error creating the user: " + err);
                    else
                        console.log("issue here");
                });

        }).catch(err => {
            console.log("rejecting here");
            reject(err);
        });

    });
}


module.exports.checkUser = (userData) => {
    return new Promise((resolve, reject) => {
        User.find({ userName: userData.userName })
            .exec()
            .then(users => {
                bcrypt.compare(userData.password, users[0].password).then(res => {
                    if (res === true) {
                        users[0].loginHistory.push({ dateTime: (new Date()).toString(), userAgent: userData.userAgent });
                        User.updateOne({ userName: users[0].userName }, { $set: { loginHistory: users[0].loginHistory } }, { multi: false })
                            .exec()
                            .then(() => { resolve(users[0]) })
                            .catch(err => { reject("There was an error verifying the user: " + err) })
                    } else {
                        reject("Incorrect Password for user: " + userData.userName);
                    }
                })
            })
            .catch(() => {
                reject("Unable to find user: " + userData.userName);
            })
    })
};