var
Router = require('js/Router'),
network = require('js/network'),
storage = __.storage,
changed=function(model){
    var cred = this.credential(model.attributes)
    network.credential(cred) 
    storage.setItem('owner', JSON.stringify(cred))
},
cache = function(model, coll){
    changed.call(this, model)

    this.signals.signin(model).send()
	if (!model.id) return startApp(this) // signed in but not a valid user, pending verification
	this.userReadied = false

    var
    users = this.deps.users,
    user=users.get(model.id),
    brief=this.deps.owner.at(0)

    if (user) {
        this.addUser(model.id, users, function(){}) // value might be outdated, update it at bg
        return userReady(null, user, this)
    }
    this.addUser(model.id, users, userReady)
},
uncache = function(){
    storage.removeItem('owner')
	network.credential(this.credential({})) // credential can be mixed
	if (this.deps.forceAuth) this.signals.signout().send()
	else startApp(this)
},      
userReady = function(err, user, self){
    if (err) return console.error(err)
    if (!user) return console.error('user not found')

    if (!self.userReadied || brief.hasChanged(['id'])) self.signals.userReady(user).send()
	self.userReadied= true
	startApp(self)
    // always home page after login? Router.home(true)
},
/*
 * 1. user has no session and forceAuth is false
 * 2. user has logout, it might b4 user ready
 * 3. owner has added but userId is 0
 */
startApp=function(self){
    if (!self.modelReadied)self.signals.modelReady().send()
    self.modelReadied= true
},
onNetworkError= function(err){
	if (403 === err.code) this.deps.owner.reset()
}

return{
    signals: ['signin', 'signout', 'modelReady', 'userReady'],
    deps: {
		owner:'models',
		users:'models',
		forceAuth:['bool',1]
    },
    create: function(deps){
        var
		self=this,
        owner = deps.owner

		owner.reset()
		this.listenTo(owner, 'add', cache)
		this.listenTo(owner, 'reset', uncache)
		this.listenTo(owner, 'change', changed)

		this.listenTo(Backbone, 'network.error', onNetworkError)

        storage.getItem('owner',function(err,cached){
			if (err) return console.error(err)

			if(cached){
				try{ return owner.add(JSON.parse(cached)) }
				catch(exp){ console.error(exp) }
			}
			uncache.call(self)
		})
    },
    // welcome to override with mixin
    addUser: function(userId, users, cb){
		if (!userId) return
        var self=this
        users.read({id:userId}, function(err, model, res){
            cb(err, model, self)
        })
    },
    credential: function(att){
        return {id:att.id, sess:att.sess}
    }
}
