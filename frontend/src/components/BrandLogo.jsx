import { useEffect, useState } from 'react'
import { imageVariants, resolveUploadUrl } from '../lib/api'

// Restoran loqosu: /uploads yolu backend ünvanına çevrilir; şəkil yüklənməsə (silinib/yanlış link) sınıq şəkil əvəzinə
// restoranın ilk hərfi olan dairə göstərilir.
function BrandLogo({ url, name, className = 'w-11 h-11' }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])

  if (!url || failed) {
    return (
      <span aria-hidden="true" className={`${className} rounded-full bg-burgundy text-cream font-display font-semibold flex items-center justify-center shrink-0`}>
        {(name || 'Q').trim().charAt(0).toUpperCase()}
      </span>
    )
  }
  return (
    <img
      src={resolveUploadUrl(imageVariants(url)?.thumb || url)}
      alt=""
      onError={() => setFailed(true)}
      className={`${className} rounded-full object-cover border-2 border-border shrink-0 bg-blush`}
    />
  )
}

export default BrandLogo
