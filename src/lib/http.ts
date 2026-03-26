import axios, { type AxiosInstance } from 'axios'
import { BACKEND_URL } from '@/config/env'

const http: AxiosInstance = axios.create({
    baseURL: BACKEND_URL,
    withCredentials: false,
    headers: { 'Content-Type': 'application/json' }
})

export default http
