export function filterPhotos(items, category='all') {
  return category==='all' ? [...items] : items.filter(item=>item.category===category);
}
export function filterCourses(items, status='all') {
  return items.filter(item=>status==='all'||item.status===status);
}
export function nextPhotoIndex(index, change, total) {
  return total>0 ? ((index+change)%total+total)%total : -1;
}
export function safeGalleryURL(value, allowedHost) {
  try {const url=new URL(value);return url.protocol==='https:'&&url.hostname===allowedHost ? url.href : null;}catch{return null;}
}
