// Lazy səhifə yüklənərkən boş ağ ekran əvəzinə skeleton göstərilir (PDF 4.8)
function PageLoader() {
  return (
    <div className="p-6 animate-pulse" role="status" aria-label="Yüklənir">
      <div className="h-7 w-48 bg-blush rounded-lg mb-6" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-blush rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

export default PageLoader
