from flask import jsonify, make_response, request
from functools import wraps

def merge_two_dicts(x, y):
    """Given two dicts, merge them into a new dict as a shallow copy."""
    z = x.copy()
    z.update(y)
    return z

def add_response_headers(headers=None, default_headers=None, cors=False):
    """
    Adds a bunch of headers to the Flask responses
    :param headers: a dictionary of headers and values to add to the response
    :param default_headers: a bunch of default security headers that all websites should have
    :return: decorator
    """
    if not headers:
        headers = {}

    if not default_headers:
        default_headers = {
            'Content-Security-Policy': ("default-src 'none'; base-uri 'none'; "
                                        "form-action 'none'; frame-ancestors 'none'"),
            'Referrer-Policy': 'no-referrer',
            'Strict-Transport-Security': 'max-age=63072000',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
        }
    headers=merge_two_dicts(default_headers,headers)

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # Don't call the underlying function if the method is OPTIONS
            if request.method == 'OPTIONS':
                resp = make_response()
            else:
                resp = make_response(fn(*args, **kwargs))

            # Append the CORS headers
            if cors:
                headers.update({
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': ', '.join(request.url_rule.methods),
                    'Access-Control-Max-Age': '86400',
                })

            # Append the headers to the response
            for header, value in headers.items():
                resp.headers[header] = value
            return resp
        return wrapper

    return decorator
