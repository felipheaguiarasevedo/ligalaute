import {shell,getPublicEvent,hydrate} from './common.js?v=20261019-1';
shell(document.body.dataset.page||'');
getPublicEvent().then(hydrate).catch(()=>{});
