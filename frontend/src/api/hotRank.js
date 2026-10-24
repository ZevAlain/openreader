import api from './client'

export function getHotRank() {
  return api.get('/hot-rank')
}
