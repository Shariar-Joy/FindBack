"""Small real HTTP load measurement; k6 scenario is supplied separately."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import statistics
import time
import httpx


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--requests", type=int, default=100)
    parser.add_argument("--concurrency", type=int, default=10)
    args = parser.parse_args()
    with httpx.Client(base_url=args.base_url, timeout=10) as client:
        def request(i):
            start = time.perf_counter()
            try:
                response = client.get('/api/v1/cases', params={"page_size": 12})
                return (time.perf_counter()-start)*1000, response.status_code != 200
            except httpx.HTTPError:
                return (time.perf_counter()-start)*1000, True
        started = time.perf_counter()
        with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
            results = list(pool.map(request, range(args.requests)))
    values = sorted(v for v, _ in results)
    result = {"scope": "Local public case-list HTTP smoke load; synthetic demo database", "requests": args.requests,
              "concurrency": args.concurrency, "median_ms": round(statistics.median(values), 2),
              "p95_ms": round(values[min(len(values)-1, int(len(values)*.95))], 2), "failed_requests": sum(e for _, e in results),
              "error_rate": sum(e for _, e in results)/len(results), "elapsed_seconds": round(time.perf_counter()-started, 2)}
    output = Path(__file__).resolve().parents[1]/'docs'/'load-results.json'
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
