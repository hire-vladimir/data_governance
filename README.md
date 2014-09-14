#Welcome

Data Governance app attempts to provide an insight into understanding of access, policies, handling, exposure, and risk in the Splunk environment. 

While every organization will have different governance policies and goals, this app will help with determining the current posture. 

App is split into several different sections that deal with specific domains:
* Users
* Roles
* Capabilities
* Indexes
* Apps
* Resources


In order to collect and provide meaningful information about the environment, “admin” role credentials are required. Alternatively, regular users can be granted following (hopefully via a dedicated role):
* Access to *_internal*, *_audit*, and *summary* indexes
* *admin_all_objects*, *edit_users*, *edit_roles* capabilities
