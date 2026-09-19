import { imageVariants, resolveUploadUrl } from '../lib/api'

// Media Library şəkilləri üçün AVIF → WebP → orijinal ardıcıllığı ilə <picture>; digər URL-lər üçün adi <img>.
// `thumb` = kiçik kart şəkli (yalnız 240px WebP kifayətdir).
function ResponsiveImage({ src, alt, sizes = '100vw', thumb = false, className, loading, ...rest }) {
  const v = imageVariants(src)
  if (!v) return <img src={resolveUploadUrl(src)} alt={alt} loading={loading} className={className} {...rest} />
  if (thumb) return <img src={resolveUploadUrl(v.thumb)} alt={alt} loading={loading} className={className} {...rest} />
  const set = (a, b) => `${resolveUploadUrl(a)} 640w, ${resolveUploadUrl(b)} 1280w`
  return (
    <picture>
      <source type="image/avif" srcSet={set(v.mdAvif, v.lgAvif)} sizes={sizes} />
      <source type="image/webp" srcSet={set(v.md, v.lg)} sizes={sizes} />
      <img src={resolveUploadUrl(v.md)} alt={alt} loading={loading} className={className} {...rest} />
    </picture>
  )
}

export default ResponsiveImage
