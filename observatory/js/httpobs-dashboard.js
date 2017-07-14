$(document).ready(function() {
    'use strict';

    // initialize all the popovers
    $(function () { $('.grade[data-toggle="popover"], a[data-toggle="popover"]').popover(
        {
            html: true,
            placement: 'top',
            trigger: 'hover'
        }
    ) });

    // the glyph info sign ones work a bit differently
    $(function () { $('.glyphicon-info-sign[data-toggle="popover"]').popover(
        {
            html: true,
            placement: 'bottom',
            trigger: 'click'
        }
    )});

    // Filter websites shown based on filter input
    $('#filter-sites').on('keyup', function (e) {
        var search = e.target.value;
        // Clear previous search
        $('table, tr').show();

        $('tr td:first-of-type a:first-of-type').each(function (i, link) {
            var linkName = link.textContent;
            if (linkName.match(search)) {
                return;
            }
            $(link).closest('tr').hide();
            return;
        });

        $('tbody').each(function (i, tbody) {
            if ($(tbody).children(':visible').length === 0) {
                $(tbody).closest('table').hide();
            }
        });
    });
});