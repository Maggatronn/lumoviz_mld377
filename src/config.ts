// Note: REACT_APP_API_URL includes /api, so we need to extract the base
const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3003/api';
export const API_BASE_URL = apiUrl.replace('/api', ''); 