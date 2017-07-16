import os
import config
import auth
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

#flask-bootstrap
from flask_bootstrap import Bootstrap
#flask-secure-headers
from flask_secure_headers.core import Secure_Headers
#flask-pyoidc
from flask_pyoidc.flask_pyoidc import OIDCAuthentication

#setup the app 
app = Flask(__name__)
#app.config.from_pyfile('env.example')
Bootstrap(app)


#logging
logger = logging.getLogger(__name__)
if os.environ.get('LOGGING') == 'True':
    logging.basicConfig(level=logging.INFO)


#config
logger.info("Choosing config")
if os.environ.get('ENVIRONMENT') == 'Production':
    # Only cloudwatch log when app is in production mode.
    #handler = watchtower.CloudWatchLogHandler()
    handler = logging.StreamHandler()
    logger.info("Using production config")
    app.logger.addHandler(handler)
    app.config.from_object(config.ProductionConfig())
else:
    # Only log flask debug in development mode.
    logger.info("Using development config")
    logging.basicConfig(level=logging.DEBUG)
    handler = logging.StreamHandler()
    logging.getLogger("werkzeug").addHandler(handler)
    app.config.from_object(config.DevelopmentConfig())


#auth = OIDCAuthentication(app,client_registration_info=client_info)
oidc_config = config.OIDCConfig()

authentication = auth.OpenIDConnect(
    oidc_config
)

oidc = authentication.auth(app)

#websec headers:
sh = Secure_Headers()
#laboratory says
# default-src 'none';
# connect-src 'self';
# script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com/ajax/libs/jquery/1.11.3/jquery.min.js https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.5/js/bootstrap.min.js;
# style-src 'unsafe-inline' https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.5/css/ 
sh.update(
    {
        'CSP': {
            'default-src': [
                'self',
            ],
            'connect-src': [
                'self',
            ],
            'script-src': [
                'self',
                'https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.4/jquery.min.js',
                'https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.7/js/bootstrap.min.js',
                
            ],
            'style-src': [
                'self',
                'https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.7/css/',
                
            ],
            'img-src': [
                'self',
            ],
            'font-src': [
                'self',
                'fonts.googleapis.com',
                'fonts.gstatic.com',
            ]
        }
    }
)

sh.update(
    {
        'HSTS':
            {
                'max-age': 15768000,
                'includeSubDomains': True,
            }
    }
)

#don't set public key pins
sh.rewrite(
    {
        'HPKP': None
    }
)

@app.route('/logout')
@oidc.oidc_logout
def logout():
    return "You've been successfully logged out."

@app.route('/info')
@sh.wrapper()
@oidc.oidc_auth
def info():
    """Return the JSONified user session for debugging."""
    return jsonify(
        id_token=session['id_token'],
        access_token=session['access_token'],
        userinfo=session['userinfo']
)

@app.route('/')
@sh.wrapper()
def main_page():
    return render_template("main_page.html")

@app.route("/contribute.json")
@sh.wrapper()
def contribute_json():
    return send_from_directory('heatmap/','contribute.json')

@app.route("/heatmap/risks.json")
@oidc.oidc_auth
@sh.wrapper()
def risks_json():
    conn=boto.connect_s3()
    bucket=conn.get_bucket(os.environ['RISKS_BUCKET_NAME'], validate=False)
    key=boto.s3.key.Key(bucket)
    key.key = os.environ['RISKS_KEY_NAME']
    risks_json=json.loads(key.get_contents_as_string())
    return(jsonify(risks_json),200)
    #return(jsonify(dict(risks=list())),200)

@app.route("/heatmap/<path:filename>")
@oidc.oidc_auth
@sh.wrapper()
def heatmap_file(filename):
    return send_from_directory('heatmap/',
                               filename)

@app.route("/observatory/index.html")
@oidc.oidc_auth
def observatory_index():
    conn=boto.connect_s3()
    bucket=conn.get_bucket(os.environ['DASHBOARD_BUCKET_NAME'], validate=False)
    key=boto.s3.key.Key(bucket)
    key.key = os.environ['DASHBOARD_KEY_NAME']
    index=key.get_contents_as_string()
    return(index,200)

@app.route("/observatory/<path:filename>")
@oidc.oidc_auth
def observatory_file(filename):
    return send_from_directory('observatory/',
                               filename)
       
# We only need this for local development.
if __name__ == '__main__':
    app.run()
