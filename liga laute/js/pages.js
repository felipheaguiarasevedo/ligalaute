import {shell,getPublicEvent,hydrate} from './common.js?v=20261116-ps2';
shell(document.body.dataset.page||'');
getPublicEvent().then(hydrate).catch(()=>{});
