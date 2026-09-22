// QA A: sevimli düyməsi əvvəllər sabit "favorite" (İngiliscə) aria-label daşıyırdı — dil dəyişəndə/AZ-da da eyni idi
// və basılı/basılmamış vəziyyəti bildirmirdi. İndi lokallaşdırılmış mətn + aria-pressed.
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FavoriteButton from '../components/FavoriteButton'
import { useFavoritesStore } from '../store/favoritesStore'
import { useLocaleStore } from '../store/localeStore'

beforeEach(() => {
  useFavoritesStore.setState({ ids: [] })
  useLocaleStore.setState({ locale: 'az' })
})

describe('FavoriteButton', () => {
  it('AZ-da lokallaşdırılmış aria-label göstərir və klikdən sonra dəyişir (aria-pressed də)', async () => {
    const user = userEvent.setup()
    render(<FavoriteButton productId={7} />)
    const btn = screen.getByRole('button', { name: 'Sevimlilərə əlavə et' })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    await user.click(btn)
    expect(screen.getByRole('button', { name: 'Sevimlilərdən sil' })).toHaveAttribute('aria-pressed', 'true')
    expect(useFavoritesStore.getState().ids).toEqual([7])
  })

  it('EN-də İngiliscə, RU-da rusca etiket göstərir', () => {
    useLocaleStore.setState({ locale: 'en' })
    const { unmount } = render(<FavoriteButton productId={1} />)
    expect(screen.getByRole('button', { name: 'Add to favorites' })).toBeInTheDocument()
    unmount()
    useLocaleStore.setState({ locale: 'ru' })
    render(<FavoriteButton productId={1} />)
    expect(screen.getByRole('button', { name: 'Добавить в избранное' })).toBeInTheDocument()
  })
})
