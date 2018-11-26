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

# flask-pyoidc
from flask_pyoidc.flask_pyoidc import OIDCAuthentication
from flask_pyoidc.provider_configuration import ProviderConfiguration, ClientMetadata
from flask_pyoidc.user_session import UserSession
# headers
from decorators import add_response_headers

# setup the app
app = Flask(__name__)


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
headers= {'Content-Security-Policy': ("default-src 'self'; form-action 'self'; connect-src 'self'; font-src 'self' https://fonts.gstatic.com; img-src 'self'; script-src 'self' ; style-src 'self' https://fonts.googleapis.com/;")}

@app.route('/')
@add_response_headers(headers=headers)
def main_page():
    return render_template("main_page.html")

@app.route("/contribute.json")
@add_response_headers(headers=headers)
def contribute_json():
    return send_from_directory('heatmap/','contribute.json',mimetype="application/json")

@app.route("/heatmap/risks.json")
@oidc.oidc_auth('auth0')
@add_response_headers(headers=headers)
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
@add_response_headers(headers=headers)
def heatmap_file(filename):
    return send_from_directory('heatmap/',
                               filename)

@app.route("/observatory/index.html")
@app.route("/observatory/")
@oidc.oidc_auth('auth0')
@add_response_headers(headers=headers)
def observatory_index():
    conn=boto.connect_s3()
    bucket=conn.get_bucket(os.environ['DASHBOARD_BUCKET_NAME'], validate=False)
    key=boto.s3.key.Key(bucket)
    key.key = os.environ['DASHBOARD_KEY_NAME']
    index=key.get_contents_as_string()
    return(index,200)

@app.route("/observatory/<path:filename>")
@oidc.oidc_auth('auth0')
@add_response_headers(headers=headers)
def observatory_file(filename):
    return send_from_directory('observatory/',
                               filename)

@app.route("/css/<path:filename>")
@add_response_headers(headers=headers)
def css_file(filename):
    return send_from_directory('css/',
                               filename)

# We only need this for local development.
if __name__ == '__main__':
    app.run()
