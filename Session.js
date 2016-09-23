var
Router = require('js/Router'),
network = require('js/network'),
storage = window.localStorage,
changed=function(model){
    var cred = this.credential(model.attributes)
    network.addon(cred) 
    storage.setItem('owner', JSON.stringify(cred))
},
cache = function(model, coll){
    changed.call(this, model)

    this.signals.signin(model).send()
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
    network.addon([]) 
    this.signals.signout().send()
},      
userReady = function(err, user, ctx){
    if (err) return console.error(err)
    if (!user) return console.error('user not found')

    if (!ctx.userReadied || brief.hasChanged(['id'])) ctx.signals.userReady(user).send()
	ctx.userReadied= true
    if (!ctx.modelReadied)ctx.signals.modelReady().send()
    ctx.modelReadied= true
    // always home page after login? Router.home(true)
},
onNetworkError= function(err){
	if (403 === err.code){
		this.signals.modelReady().sendNow() // router may not initialized
		this.deps.owner.reset()
	}
}

return{
    signals: ['signin', 'signout', 'modelReady', 'userReady'],
    deps: {
		owner:'models',
		users:'models',
		forceAuth:['bool',1]
    },
    create: function(deps){
		network.addon(this.credential({})) // credential can be mixed

        var
        owner = deps.owner,
        cached = storage.getItem('owner')

        owner.reset()
        this.listenTo(owner, 'add', cache)
        this.listenTo(owner, 'reset', uncache)
        this.listenTo(owner, 'change', changed)

        this.listenTo(Backbone, 'network.error', onNetworkError)

        if(cached){
            try{ return owner.add(JSON.parse(cached)) }
            catch(exp){ console.error(exp) }
        }
		if (deps.forceAuth) this.signals.signout().send()
        else this.signals.modelReady().send()
    },
    // welcome to override with mixin
    addUser: function(userId, users, cb){
		if (!userId) return
        var self=this
        users.read({}, function(err, model, res){
            cb(err, model, self)
        })
    },
    credential: function(att){
        return {id:att.id, sess:att.sess}
    }
}
