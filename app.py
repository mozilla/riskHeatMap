import os
import config
import logging
import boto
import json
from flask import (
    Flask,
    redirect,
    render_template,
    request,
    session,
    url_for,
    make_response,
    send_from_directory,
    jsonify
)

# flask-bootstrap
from flask_bootstrap import Bootstrap
# flask-pyoidc
from flask_pyoidc.flask_pyoidc import OIDCAuthentication
from flask_pyoidc.provider_configuration import ProviderConfiguration, ClientMetadata
from flask_pyoidc.user_session import UserSession
# headers
from decorators import add_response_headers

# setup the app
app = Flask(__name__)
Bootstrap(app)

# logging
logger = logging.getLogger(__name__)
if os.environ.get('LOGGING') == 'True':
    logging.basicConfig(level=logging.INFO)


# config
logger.info("Choosing config")
if 'prod' in os.environ.get('ENVIRONMENT').lower():
    logger.info("Using production config")
    app.config.from_object(config.ProductionConfig())
else:
    # Only log flask debug in development mode.
    logger.info("Using development config")
    logging.basicConfig(level=logging.DEBUG)
    app.config.from_object(config.DevelopmentConfig())

# setup oidc
oidc_config = config.OIDCConfig()
auth0_Config=ProviderConfiguration(issuer='https://{}'.format(oidc_config.OIDC_DOMAIN),
                                    client_metadata=ClientMetadata(oidc_config.OIDC_CLIENT_ID,oidc_config.OIDC_CLIENT_SECRET)
)
oidc=OIDCAuthentication({'auth0':auth0_Config},app=app)

#websec headers:

#laboratory says
# default-src 'none';
# connect-src 'self';
# script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com/ajax/libs/jquery/1.11.3/jquery.min.js https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.5/js/bootstrap.min.js;
# style-src 'unsafe-inline' https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.5/css/
# uncomment when it's py3 capable: https://github.com/twaldear/flask-secure-headers/pull/9
# sh = Secure_Headers()
# sh.update(
#     {
#         'CSP': {
#             'default-src': [
#                 'self',
#             ],
#             'connect-src': [
#                 'self',
#             ],
#             'script-src': [
#                 'self',
#                 'https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.4/jquery.min.js',
#                 'https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.7/js/bootstrap.min.js',

#             ],
#             'style-src': [
#                 'self',
#                 'https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.7/css/',

#             ],
#             'img-src': [
#                 'self',
#             ],
#             'font-src': [
#                 'self',
#                 'fonts.googleapis.com',
#                 'fonts.gstatic.com',
#             ]
#         }
#     }
# )

# sh.update(
#     {
#         'HSTS':
#             {
#                 'max-age': 15768000,
#                 'includeSubDomains': True,
#             }
#     }
# )

# #don't set public key pins
# sh.rewrite(
#     {
#         'HPKP': None
#     }
# )

@app.route('/logout')
@oidc.oidc_logout
def logout():
    return "You've been successfully logged out."

@app.route('/info')
@oidc.oidc_auth('auth0')
def info():
    """Return the JSONified user session for debugging."""
    oidc_session = UserSession(session)
    return jsonify(
        id_token=oidc_session['id_token'],
        access_token=oidc_session['access_token'],
        userinfo=oidc_session['userinfo']
)

@app.route('/')
def main_page():
    return render_template("main_page.html")

@app.route("/contribute.json")
def contribute_json():
    return send_from_directory('heatmap/','contribute.json')

@app.route("/heatmap/risks.json")
@oidc.oidc_auth('auth0')
def risks_json():
    conn=boto.connect_s3()
    bucket=conn.get_bucket(os.environ['RISKS_BUCKET_NAME'], validate=False)
    key=boto.s3.key.Key(bucket)
    key.key = os.environ['RISKS_KEY_NAME']
    risks_json=json.loads(key.get_contents_as_string())
    return(jsonify(risks_json),200)
    #return(jsonify(dict(risks=list())),200)

@app.route("/heatmap/<path:filename>")
@oidc.oidc_auth('auth0')
def heatmap_file(filename):
    return send_from_directory('heatmap/',
                               filename)

@app.route("/observatory/index.html")
@app.route("/observatory/")
@oidc.oidc_auth('auth0')
def observatory_index():
    conn=boto.connect_s3()
    bucket=conn.get_bucket(os.environ['DASHBOARD_BUCKET_NAME'], validate=False)
    key=boto.s3.key.Key(bucket)
    key.key = os.environ['DASHBOARD_KEY_NAME']
    index=key.get_contents_as_string()
    return(index,200)

@app.route("/observatory/<path:filename>")
@oidc.oidc_auth('auth0')
def observatory_file(filename):
    return send_from_directory('observatory/',
                               filename)

# We only need this for local development.
if __name__ == '__main__':
    app.run()
