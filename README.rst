Overview
========

A dashboard site for the risk heatmap and the observatory dashboard.
Hosted in AWS, lambda/serverless via the serverless framework.

The risk heatmap and observatory dashboard are just plain html/js files. The AWS/Serverless bits are just for scaling and authentication.

Data Model Overview
===================
The risk heatmap is made up of several elements:

 - services
 - asset groups
 - assets
 - indicators

All of these combine to determine how the services display risk.

Services are the focal point for rolling up the other elements into a risk-based heatmap view. Services are simply things you run in your environment (your website, your HR system, your order processing, etc).
Services with little information (no assets, etc) are more opaque (i.e. see through). Services with a full compliment of asset groups/assets/indicators are solid.
Each service is given three scores that determine its heatmap display:

 - Risk score
 - Visibility score
 - Impact score

The risk score is the summary of the underlying asset groups, their assets and the risk score of the indicators we have visibility to.
The visibility score is a rating of how much data/visibility we have about a service.
The impact score is a rating of how impactful this service is in our environment to our overall risk.

The display orients itself as follows:
 - The higher the risk score, the taller the service.
 - The higher the visibility score the less opague, more solid the service.
 - The higher the impact, the darker the color

 From these display elements you can determine which services in your environment need attention.

Service Data Model
==================
At the very least, a service needs to have the following JSON fields:
 - name: The name of the service

Ideally it also has:
 - highest_risk_impact: The impact rating (one of unknown, none, low, medium, high, maximum)

If impact is not provided, it is considered 'unknown'.
Any other key: value pairs associated with the service will be displayed in the details panel when a service is selected. URLs will automatically be turned into HTML links.

Asset Group Data Model
=======================
Asset groups are simply groups of asssets. For example if you have a 'Service' that is your company.com website, you may have an asset group for website-production and another one for website-development.

An Asset group needs to have the following JSON fields:
 - name: the name of the group (website-production for example)
It can also contain:
 - description: a text sentence about the group

Asset Data Model
================
An asset is a technical component of a service. A server, a database, an AWS account, a web site, etc can all be examples of an asset.

Assets need the following JSON fields:
 - asset_identifier: the unique identifier for the asset (server fqdn, website domain name, etc)

Any other key/value fields accompanying the asset will be used in displaying the detail

Indicator Data Model
====================
An indicator is meant to be a flexible way of relating something we know about an asset that may 'indicate' risk. For example, a summary of vulnerabilities associated with an asset, a score from the web observatory, a summary of a web application security scan, etc.
Indicators are the most complex data model but follow a similar pattern:

Fields:
 - description: A sentence describing the indicator ("Mozilla Observatory scan" for example)
 - details: a sub object containing the details for each type of indicator

Observatory Indicator
=====================
Mozilla Observatory scores are summarized into indicators as follows:


    "description": "Mozilla Observatory scan",
    "details": {
        "grade": "A+",
        "tests": [
            {
                "name": "content-security-policy",
                "pass": true
            },
            {
                "name": "contribute",
                "pass": true
            },
        ]
    },
    "event_source_name": "Mozilla Observatory",
    "id": "c996310e-9dda-4b93-aae5-6f9680e35fd9",
    "likelihood_indicator": "medium",
    "timestamp_utc": "2018-09-28T19:36:46.200307+00:00"

As you can see the grade along with the individual tests, noting pass/fail are presented.

Vulnerability Indicator
=======================

Contacts
--------
Jeff Bryner <jeff@jeffbryner.com>, twitter @0x7eff
April King  <april@mozilla.org>
