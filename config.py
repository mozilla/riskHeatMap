#!/usr/bin/python
"""Configuration loader"""

import os
import credstash

class Config(object):
    """Defaults"""
    DEBUG=True
    TESTING=False
    #SECRET_KEY=os.environ['SECRET_KEY']
    SECRET_KEY = credstash.getSecret(
        name="riskheatmap.secret_key",
        context={'app': 'riskheatmap'},
        region="us-east-1"
    )
    SERVER_NAME = os.environ['SERVER_NAME']
    PERMANENT_SESSION = os.environ['PERMANENT_SESSION']
    PERMANENT_SESSION_LIFETIME = int(os.environ['PERMANENT_SESSION_LIFETIME'])
    SESSION_COOKIE_HTTPONLY = True
    LOGGER_NAME = "riskheatmap"
 
    
class ProductionConfig(Config):
    DEBUG = False


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = False


class TestingConfig(Config):
    TESTING = True


class OIDCConfig(object):
    """Convienience Object for returning required vars to flask."""
    def __init__(self):
        """General object initializer."""
        self.OIDC_DOMAIN = os.environ['OIDC_DOMAIN']
        self.OIDC_CLIENT_ID = credstash.getSecret(
            name="riskheatmap.oidc_client_id",
            context={'app': 'riskheatmap'},
            region="us-east-1"
            )
        self.OIDC_CLIENT_SECRET = credstash.getSecret(
            name="riskheatmap.oidc_client_secret",
            context={'app': 'riskheatmap'},
            region="us-east-1"
            )
        self.LOGIN_URL = "https://{DOMAIN}/login?client={CLIENT_ID}".format(
            DOMAIN=self.OIDC_DOMAIN,
            CLIENT_ID=self.OIDC_CLIENT_ID
        )

    def auth_endpoint(self):
        return "https://{DOMAIN}/authorize".format(
            DOMAIN=self.OIDC_DOMAIN
        )

    def token_endpoint(self):
        return "https://{DOMAIN}/oauth/token".format(
            DOMAIN=self.OIDC_DOMAIN
        )

    def userinfo_endpoint(self):
        return "https://{DOMAIN}/userinfo".format(
            DOMAIN=self.OIDC_DOMAIN
        )

    def client_id(self):
        return self.OIDC_CLIENT_ID

    def client_secret(self):
        return self.OIDC_CLIENT_SECRET