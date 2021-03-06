
# Haplo standard platform plugins development

This repository contains development versions of the standard plugins bundled in the Haplo platform.

When new versions are ready for release, they're copied to the main Haplo repository.

Note that these plugins use private platform APIs, and those APIs may change without notice. Don't use these APIs in your plugins.

### Development

Use `haplo-plugin` to push this to a Haplo server with development enabled. This version will override the built-in plugin.

To try the examples in an application, create one with

    db/init_app.sh haplo teststandard.haplodev00.local "Test Standard" minimal_with_common_permissions 123456

and create a user with a representative object for testing.

### License

Haplo is licensed under the Mozilla Public License Version 2.0. See the LICENSE file for full details.

### Copyright

Haplo is copyright [Haplo Services Ltd](http://www.haplo-services.com). See the COPYRIGHT file for full details.

