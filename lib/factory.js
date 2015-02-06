/*───────────────────────────────────────────────────────────────────────────*\
 │  Copyright (C) 2015 eBay Software Foundation                               │
 │                                                                            │
 │  Licensed under the Apache License, Version 2.0 (the "License");           │
 │  you may not use this file except in compliance with the License.          │
 │  You may obtain a copy of the License at                                   │
 │                                                                            │
 │    http://www.apache.org/licenses/LICENSE-2.0                              │
 │                                                                            │
 │  Unless required by applicable law or agreed to in writing, software       │
 │  distributed under the License is distributed on an "AS IS" BASIS,         │
 │  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  │
 │  See the License for the specific language governing permissions and       │
 │  limitations under the License.                                            │
 \*───────────────────────────────────────────────────────────────────────────*/
import shush from 'shush'
import Path from 'path';
import debuglog from 'debuglog';
import Config from './config';
import Common from './common';
import Handlers from './handlers';
import Provider from './provider';

const debug = debuglog('confit');

export default class Factory {

    constructor({ basedir, protocols =  {}, defaults = 'config.json' }) {
        this.basedir = basedir;
        this.protocols = protocols;
        this.promise = Promise.resolve({})
            .then(store => Common.merge(Provider.argv(), store))
            .then(store => Common.merge(Provider.env(), store))
            .then(store => Common.merge(Provider.convenience(), store))
            .then(Factory.conditional(store => {
                let file = Path.join(this.basedir, defaults);
                return Common.merge(shush(file), store)
            }))
            .then(Factory.conditional(store => {
                let file = Path.join(this.basedir, store.env.env + '.json');
                return Common.merge(shush(file), store);
            }));
    }

    static conditional(fn) {
        return function (store) {
            try {
                return fn(store);
            } catch (err) {
                if (err.code && err.code === 'MODULE_NOT_FOUND') {
                    debug('WARNING:', err.message);
                    return store;
                }
                throw err;
            }
        }
    }

    addDefault(obj) {
        obj = this._resolveFile(obj);

        this.promise = this.promise.then((store) => {
            let handler = Handlers.resolveImport(obj, this.basedir);
            return handler.then((obj) => Common.merge(store, obj))
        });

        return this;
    }

    addOverride(obj) {
        obj = this._resolveFile(obj);

        this.promise = this.promise.then((store) => {
            let handler = Handlers.resolveImport(obj, this.basedir);
            return handler.then((obj) => Common.merge(obj, store))
        });

        return this;
    }

    create(cb) {
        this.promise
            .then(store => Handlers.resolveImport(store, this.basedir))
            .then(store => Handlers.resolveCustom(store, this.protocols))
            .then(store => Handlers.resolveConfig(store))
            .then(store => cb(null, new Config(store)), cb);
    }

    _resolveFile(path) {
        if (typeof path === 'string') {
            let file = Common.isAbsolute(path) ? path : Path.join(this.basedir, path);
            return shush(file);
        }
        return path;
    }

}