/* Haplo Platform                                     http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

// proof of concept

(function($) {

    var endURL = "/do/authentication/end_impersonation";
    var startURL = "/do/authentication/impersonate";
    var csrf;

    var quickImpersonate = function(uid) {
        // end impersonation
        $.post(endURL, {__: csrf}).
            done(function(data) {
                // impersonate a new user
                $.post(startURL, {__: csrf, uid: uid}).
                    done(function(data) {
                        // reload so that we're now the new user
                        location.reload();
                    });
            });
    };

    $(document).ready(function() {
        csrf = $('input[name=__]').val();

        // quick impersonate
        // abuses lots of things we shouldn't, like minified css class names
        var currentlyWith = $('.ef')[1];
        // get uid from what we rendered in the template
        var uid = $(".quick-impersonate").data("uid");
        if(uid) {
            // add button for Impersonate
            $('<a href="#" class="ef quick-impersonate" data-uid="'+uid+'"><span class="bk bl"></span>Impersonate</a>').insertAfter($(currentlyWith));
            // make the currently with text clickable
            $(currentlyWith).on("click", function() {
                quickImpersonate(uid);
            });
            $(currentlyWith).on("mouseover", function() {
                $(this).css('cursor','pointer');
            });
            $(".quick-impersonate").on('click', function() {
                quickImpersonate(uid);
            });
        }

        // quick move state
        var note = $('.ed').last();
        var link = note.find('a');
        // if we're already logged in as admin, the last box has 4 links in it,
        // so only display if there's a single element
        // (abusing the knowledge that 'add note' is usually last in the sidebar)
        if(link.length === 1) {
            var wuid = link[0].href.split("/").pop();
            $('<div class="ed"><a href="/do/workflow/administration/move-state/'+wuid+'" class="ef move-state"><span class="bk bn"></span>Move state</a></div>').insertAfter($(note));
            $(".move-state").on('click', function() {
                var link = $(this);
                $.post(endURL, {__: csrf}).
                    done(function(data) {
                        window.location = link.attr('href');
                    });
                return false;
            });
        }
    });

})(jQuery);
