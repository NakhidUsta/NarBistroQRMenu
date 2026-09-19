// Təkrar hadisədən qorunma: backend hər hadisəyə unikal `_eid` əlavə edir; bağlantı bərpasında eyni hadisə
// ikinci dəfə çatdırılarsa (məs. itirilmiş hadisələrin təkrar göndərilməsi) yenidən işlənməsin.
const MAX_REMEMBERED = 500
const seen = new Set()

// true qaytarırsa hadisə artıq işlənib (atılmalıdır). `_eid`-siz hadisələr həmişə yeni sayılır.
export function alreadySeen(eid) {
  if (!eid) return false
  if (seen.has(eid)) return true
  seen.add(eid)
  if (seen.size > MAX_REMEMBERED) seen.delete(seen.values().next().value) // ən köhnəni unut
  return false
}

export function resetSeenEvents() {
  seen.clear()
}
