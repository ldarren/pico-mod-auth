var
store=__.store(),
merge1={merge:true},
dummyCB=function(err){if(err)return console.error(err)},
addRemove = function(coll, list){
    if (!coll || !list || !list.length) return false
    coll.add(list, merge1)
    return true
},
writeData = function(model){ writeColl(this, model.collection.name, this.cred.id) },
sseCB=function(raw){
	var userId = this.cred.id
	if (!userId) return
	writeSeen(this, userId, raw.t)
	var models=this.deps.models
	for(var i=0,keys=Object.keys(raw),k; k=keys[i]; i++){
		addRemove(models[k],raw[k])
	}
},
reconn=function(count){
    if (!this.retry(count||0) || !this.cred) return
    var push=this.deps.push
    this.connect(push, this.cred.attributes, this.seen)
    this.stopListening(push)
    this.listenTo(push, 'closed', reconn) // when server side shutdown connect
    this.listenTo(push, 'connecting', this.retry)// when client cant react server
    for(var i=0,evts=this.deps.push.events,e; e=evts[i]; i++){
        this.listenTo(push, e, sseCB)
    }
},
sortDesc = function(m1, m2){
    var s1 = m1.get('uat'), s2 = m2.get('uat')
    return s1 < s2 ? 1 : s1 > s2 ? -1 : 0;
},
sortAsc = function(m1, m2){
    var s1 = m1.get('uat'), s2 = m2.get('uat')
    return s1 < s2 ? -1 : s1 > s2 ? 1 : 0;
},
readSeen= function(self,userId,cb){
	cb=cb||dummyCB
    store.getItem('seen'+userId,function(err,seen){
		if(err) return cb(err)
		try{self.seen=JSON.parse(seen)||0}
		catch(e){self.seen=0}
		cb(null,self.seen)
	})
},
writeSeen= function(self,userId,seen,cb){
    store.setItem('seen'+userId, self.seen = seen, cb)
},
removeSeen= function(self,userId,cb){
    store.removeItem('seen'+userId,cb)
},
readColl= function(self,name,userId,cb){
	cb=cb||dummyCB
    var coll = self.deps.models[name]
    if (!userId || !coll) return cb()
	store.getItem(name+userId,function(err,json){
		if(err) return cb(err)
		if(!json) return cb()
		try{ coll.add(JSON.parse(json)) }
		catch(exp){ return cb(exp) }
		cb(null,coll)
	})
},
writeColl= function(self,name,userId,cb){
    var coll = self.deps.models[name]
    if (!userId || !coll || !coll.length) return cb()
    store.setItem(name+userId, JSON.stringify(coll.toJSON()),cb)
},
removeColl= function(self,name,userId,cb){
    store.removeItem(name+userId,cb)
}

return{
    signals:[],
    deps:{
        models:'refs',
        push:'stream'
    },
    create: function(deps){
        for(var i=0,models=deps.models,keys=Object.keys(models),k; k=keys[i]; i++){
            models[k].comparator=sortDesc
        }
        this.addSSEEvents()
    },

    slots:{
        signin: function(from, sender, model){
            if(this.cred && this.cred.id)this.slots.signout.call(this)
            var
			self=this,
			userId = model.id

            this.cred=model 

            for(var i=0,models=this.deps.models,keys=Object.keys(models),k,d; k=keys[i]; i++){
                readColl(this,k, userId)
                d=models[k]
                this.listenTo(d, 'add', writeData)
                this.listenTo(d, 'remove', writeData)
                this.listenTo(d, 'change', writeData)
            }

            readSeen(this,userId,function(err){
				if (err) return console.error(err)
				reconn.call(self)
			})
        },
        signout: function(){
			if (!this.cred) return
			this.deps.push.close()
            this.stopListening()
			var userId=this.cred.id

            for(var i=0,models=this.deps.models,keys=Object.keys(models),k; k=keys[i]; i++){
                models[k].reset()
            }
			store.clear()

            this.seen = 0
            this.cred= null
        },
        refreshCache: function(){
			if (!this.cred) return
            var userId = this.cred.id

            for(var i=0,models=this.deps.models,keys=Object.keys(models),k; k=keys[i]; i++){
                models[k].reset()
                removeColl(this,k, userId)
            }

            removeSeen(this,userId)
            readSeen(this,userId)
        },
		online: function(){
			reconn.call(this)
		},
		offline: function(){
			this.deps.push.close()
		}
    },

    addSSEEvents: function(){
    },
    connect: function(stream, model, seen, count){
        stream.reconnect({t:this.seen})
    },
    retry: function(count){
		return 10 > count ? 1 : 0
    }
}
