import {shell,getPublicEvent,hydrate} from './common.js?v=10';
shell(document.body.dataset.page||'');
getPublicEvent().then(hydrate).catch(()=>{});
