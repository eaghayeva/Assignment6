/*********************************************************************************
 *  WEB322 – Assignment 06
 *  I declare that this assignment is my own work in accordance with Seneca  Academic Policy.  No part 
 *  of this assignment has been copied manually or electronically from any other source 
 *  (including 3rd party web sites) or distributed to other students.
 * 
 *  Name: ____Emiliya Aghayeva__________________ Student ID: _____148398217_________ Date: ______07.04.2023__________
 *
 *  Online (Cyclic) Link: __________https://defiant-fox-peplum.cyclic.app______________________________________________
 *
 ********************************************************************************/


var authData = require('./auth-service')
var express = require('express');
const exphbs = require('express-handlebars');
var app = express();
var path = require("path");
var blogService = require("./blog-service");
const fs = require('fs');
const multer = require("multer");
const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')
const stripJs = require('strip-js');
const clientSessions = require("client-sessions");

const bodyparser = require('body-parser');
app.use(express.static('public'))
app.use(bodyparser.json());

var HTTP_PORT = process.env.PORT || 8080;

cloudinary.config({
    cloud_name: 'dp3hbncmb',
    api_key: '283872449448813',
    api_secret: '4ShBBtluuAOtsoorh5iFS7YVEiw',
    secure: true
});

app.set('view engine', '.hbs');

app.use(function(req, res, next) {
    let route = req.path.substring(1);
    app.locals.activeRoute = "/" + (isNaN(route.split('/')[1]) ? route.replace(/\/(?!.*)/, "") : route.replace(/\/(.*)/, ""));
    app.locals.viewingCategory = req.query.category;
    next();
});

const upload = multer();

app.use(express.urlencoded({ extended: true }));

app.engine('.hbs', exphbs.engine({
    extname: '.hbs',
    defaultLayout: 'main',

    helpers: {
        navLink: function(url, options) {
            return '<li' +
                ((url == app.locals.activeRoute) ? ' class="active" ' : '') +
                '><a href="' + url + '">' + options.fn(this) + '</a></li>';
        },
        safeHTML: function(context) {
            return stripJs(context);

        },
        equal: function(lvalue, rvalue, options) {
            if (arguments.length < 3)
                throw new Error("Handlebars Helper equal needs 2 parameters");
            if (lvalue != rvalue) {
                return options.inverse(this);
            } else {
                return options.fn(this);
            }
        },
        formatDate: (dateObj) => {
            let year = dateObj.getFullYear();
            let month = (dateObj.getMonth() + 1).toString();
            let day = dateObj.getDate().toString();
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

    }
}));

app.use(clientSessions({
    cookieName: "session",
    secret: "week10example_web322",
    duration: 2 * 60 * 1000,
    activeDuration: 1000 * 60
}));

app.use(function(req, res, next) {
    res.locals.session = req.session;
    next();
});

function ensureLogin(req, res, next) {
    if (!req.session.user) {
        res.redirect("/login");
    } else {
        next();
    }
}




app.get("/login", (req, res) => {
    res.render("login");
});



app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", (req, res) => {
    authData.registerUser(req.body)
        .then(() => res.render("register", { successMessage: "User created" }))
        .catch(err => res.render("register", { errorMessage: err, userName: req.body.userName }))
});

app.post("/login", (req, res) => {
    req.body.userAgent = req.get('User-Agent');
    authData.checkUser(req.body).then((user) => {
        req.session.user = {
            userName: user.userName,
            email: user.email,
            loginHistory: user.loginHistory
        }
        res.redirect('/posts');
    }).catch((err) => {
        res.render("login", { errorMessage: err, userName: req.body.userName });
    });
});



app.get("/logout", (req, res) => {
    req.session.reset();
    res.redirect("/");
});



app.get("/userHistory", ensureLogin, (req, res) => {
    res.render("userHistory");
});

app.get('/', (req, res) => {
    res.redirect('/blog');
});

app.get("/about", function(req, res) {
    res.render(path.join(__dirname + "/views/about.hbs"));
});


app.get('/blog', async(req, res) => {
    var viewData = { post: {}, posts: [] };
    try {
        let posts = [];
        if (req.query.category) {
            posts = await blogService.getPostsByCategory(req.query.category);
        } else {
            posts = await blogService.getAllPosts();
        }
        posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));
        let post = posts[0];
        viewData.posts = posts;
        viewData.post = post;

    } catch (err) {
        viewData.message = "no results";
    }
    try {
        let categories = await blogService.getCategories();
        viewData.categories = categories;
    } catch (err) {
        viewData.categoriesMessage = "no results"
    }
    console.log(viewData.post);
    res.render("blog", { data: viewData })

});


app.get('/blog/:id', async(req, res) => { 
    var viewData = { post: {}, posts: [] };
    try {
        let posts = [];
        if (req.query.category) {
            posts = await blogService.getPublishedPostsByCategory(req.query.category);
        } else {
            posts = await blogService.getPublishedPosts();
        }
        posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));
        viewData.posts = posts;
    } catch (err) {
        viewData.message = "no results";
    }
    try {
        viewData.post = await blogService.getPostById(req.params.id);
    } catch (err) {
        viewData.message = "no results";
    }
    try {
        let categories = await blogService.getCategories();
        viewData.categories = categories;
    } catch (err) {
        viewData.categoriesMessage = "no results"
    }
    res.render("blog", { data: viewData })
});

app.get("/posts", ensureLogin, function(req, res) {
    let category = req.query.category;
    let minDate = req.query.minDate;
    if (category) {
        blogService.getPostsByCategory(category).then(data => {
            if (data.length > 0) {
                res.render("posts", { posts: data });
            } else {
                res.render("posts", { message: "no results" });
            }
        })
    } else if (minDate != "" && minDate != null) {
        blogService.getPostsByMinDate(minDate).then(data => {
            if (data.length > 0) {
                res.render("posts", { posts: data });
            } else {
                res.render("posts", { message: "no results" });
            }
        })
    } else {
        blogService.getAllPosts().then(data => {
            if (data.length > 0) {
                res.render("posts", { posts: data });
            } else {
                res.render("posts", { message: "no results" });
            }
        })
    }
});

app.get("/categories", ensureLogin, function(req, res) {

    blogService.getCategories().then(data => {
        if (data.length > 0) {
            res.render("categories", { categories: data });
        } else {
            res.render("categories", { message: "no results" });
        }
    })
});

//Add Category GET route
app.get("/categories/add", ensureLogin, (req, res) => {
    res.render(path.join(__dirname, "/views/addCategory.hbs"));
});

// Categories Add POST Route
app.post("/categories/add", ensureLogin, (req, res) => {
    blogService.addCategory(req.body).then(() => {
        res.redirect("/categories");
    })
});


// Categories/Delete/:ID Route
app.get("/categories/delete/:id", ensureLogin, (req, res) => {
    blogService.deleteCategoryById(req.params.id)
        .then(() => {
            res.redirect("/categories");
        }).catch(err => {
            res.status(500).send("Unable to Remove Category / Category not found");
            console.log(err);
        });
});

app.get('/posts/add', ensureLogin, (req, res) => {

    blogService.getCategories()
        .then(data => res.render("addPost", { categories: data }))
        .catch(err => {
            res.render("addPost", { categories: [] })
            console.log(err);
        });

});

app.post("/posts/add", ensureLogin, upload.single("featureImage"), (req, res) => {

    let streamUpload = (req) => {
        return new Promise((resolve, reject) => {
            let stream = cloudinary.uploader.upload_stream(
                (error, result) => {
                    if (result) {
                        resolve(result);
                    } else {
                        reject(error);
                    }
                }
            );

            streamifier.createReadStream(req.file.buffer).pipe(stream);
        });
    };

    async function upload(req) {
        let result = await streamUpload(req);
        console.log(result);
        return result;
    }

    upload(req).then((uploaded) => {
        req.body.featureImage = uploaded.url;
        // TODO: Process the req.body and add it as a new Blog Post before redirecting to /posts

        var postData = req.body;
        blogService.addPost(postData).then(data => {
            res.redirect('/posts');
        }).catch(err => {
            res.send(err);
        });


    });


});

// Posts/Delete/:ID Route
app.get("/posts/delete/:id", ensureLogin, (req, res) => {
    blogService.deletePostById(req.params.id)
        .then(() => {
            res.redirect("/posts");
        }).catch(err => {
            res.status(500).send("Unable to Remove Post / Post not found");
            console.log(err);
        });
});
app.get('/posts/:id', ensureLogin, (req, res) => {
    blogService.getPostById(req.params.id).then((data) => {
        res.send(data);
    }).catch((err) => {
        res.send("No Result Found");
    })
});

app.get("*", (req, res) => {
        res.render(path.join(__dirname + "/views/pnf.hbs"));
    }) // if no matching route is found default to 404 with message "Page Not Found"




blogService.initialize()
    .then(authData.initialize)
    .then(function() {
        app.listen(HTTP_PORT, function() {
            console.log("app listening on: " + HTTP_PORT)
        });
    }).catch(function(err) {
        console.log("Can not start !! " + err);
    });
