import http from 'k6/http'
import { check, sleep } from 'k6'
export const options = { stages: [{duration:'10s',target:5},{duration:'30s',target:10},{duration:'10s',target:0}], thresholds: {http_req_failed:['rate<0.01'],http_req_duration:['p(95)<2000']} }
export default function () {
  const base=__ENV.BASE_URL||'http://127.0.0.1:8000'
  const r=http.get(`${base}/api/v1/cases?page_size=12`)
  check(r,{'case directory returns 200':r=>r.status===200})
  sleep(.5)
}
