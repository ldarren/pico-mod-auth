var
Router = require('js/Router'),
network = require('js/network'),
store = __.store(),
changed=function(model){
    var cred = this.credential(model)
    network.credential(cred) 
    store.setItem('credential', JSON.stringify(cred))
},
uncache = function(){
    store.removeItem('credential')
	network.credential(this.credential()) // credential can be mixed
	if (this.deps.forceAuth) this.signals.signout().send()
	else startApp(this)
},
cache = function(model, coll){
    changed.call(this, model)

    this.signals.signin(model).send()
	if (!model.id) return startApp(this) // signed in but not a valid user, pending verification
	this.userReadied = false

    var
    users = this.deps.users,
    user=users.get(model.id)

    if (user) {
        this.addUser(model.id, users, function(){}) // value might be outdated, update it at bg
        return userReady(null, user, this)
    }
    this.addUser(model.id, users, userReady)
},
userReady = function(err, user, self){
    if (err) return console.error(err)
    if (!user) return console.error('user not found')

    if (!self.userReadied || self.deps.credential.hasChanged(['id'])) self.signals.userReady(user).send()
	self.userReadied= true
	startApp(self)
    // always home page after login? Router.home(true)
},
/*
 * 1. user has no session and forceAuth is false
 * 2. user has logout, it might b4 user ready
 * 3. credential has added but id is 0
 */
startApp=function(self){
    if (!self.modelReadied)self.signals.modelReady().send()
    self.modelReadied= true
},
onNetworkError= function(err){
	if (403 === err.code) this.deps.credential.reset()
}

return{
    signals: ['signin', 'signout', 'modelReady', 'userReady'],
    deps: {
		credential:'models',
		users:'models',
		forceAuth:['bool',1]
    },
    create: function(deps){
        var
		self=this,
        cred = deps.credential

		cred.reset()
		this.listenTo(cred, 'add', cache)
		this.listenTo(cred, 'reset', uncache)
		this.listenTo(cred, 'change', changed)

		this.listenTo(Backbone, 'network.error', onNetworkError)

        store.getItem('credential',function(err,cached){
			if (err) return console.error(err)

			if(cached){
				try{ return cred.add(JSON.parse(cached)) }
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
    credential: function(model){
		if (!model) return {}
        return model.attributes
    }
}
